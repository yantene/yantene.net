import { Temporal } from "@js-temporal/polyfill";
import { contentTypeForPath } from "./asset-content-type";
import { resolveAssetUrl } from "./note-asset-url";
import { parseNoteContent } from "./note-content-parser";
import type { ContentEntry, IContentStore } from "~/backend/domain/content";
import type {
  INoteCommandRepository,
  INoteContentCache,
  INoteQueryRepository,
} from "~/backend/domain/note";
import type { IUnpersisted } from "~/backend/domain/shared";
import { ImageUrl, Note, NoteSlug, NoteTitle } from "~/backend/domain/note";

const noteSourcePattern = /^notes\/[^/]+\.md$/;

/** refresh の実行結果サマリ。 */
export interface RefreshResult {
  /** 再処理した slug。 */
  readonly processed: string[];
  /** 削除した slug (Artifacts から消えたノート)。 */
  readonly deleted: string[];
  /** 不正なコンテンツ (フロントマター等) でスキップしたファイル。 */
  readonly skipped: { path: string; reason: string }[];
}

interface NoteGroup {
  readonly slug: NoteSlug;
  readonly base: string;
  readonly sourcePath: string;
  readonly assetPrefix: string;
  readonly assets: readonly ContentEntry[];
  /** md + 全アセットのハッシュを合成した変更検出用ハッシュ。 */
  readonly contentHash: string;
}

/** コンテンツ由来のエラー (フロントマター不正等)。infra エラーと区別してスキップ扱いにする。 */
class NoteContentError extends Error {
  readonly name = "NoteContentError";
}

/**
 * Artifacts → D1 + R2 のコンテンツ同期サービス。
 *
 * ツリーを取得し、md + アセットの合成ハッシュで変更を検出、変わったノートだけ内容を
 * 読み直して MDAST を R2 にキャッシュ・メタデータを D1 に upsert・画像を R2 にキャッシュ
 * する。Artifacts から消えたノートは D1 / R2 から掃除する (ADR 0005)。
 *
 * コンテンツ不正 (フロントマター欠落等) はスキップして結果に記録するが、infra 障害
 * (Artifacts / R2 / D1) は握りつぶさず throw する (fail-loud)。
 */
export class NotesRefreshService {
  constructor(
    private readonly content: IContentStore,
    private readonly command: INoteCommandRepository,
    private readonly query: INoteQueryRepository,
    private readonly cache: INoteContentCache,
  ) {}

  async refresh(): Promise<RefreshResult> {
    const tree = await this.content.listTree();
    const groups = groupNotes(tree);
    const stored = await this.query.listSourceHashes();

    const processed: string[] = [];
    const skipped: { path: string; reason: string }[] = [];
    const seen = new Set<string>();

    for (const group of groups) {
      const slug = group.slug.toString();
      seen.add(slug);
      if (stored.get(slug) === group.contentHash) continue; // 変更なし
      try {
        await this.syncNote(group);
        processed.push(slug);
      } catch (error) {
        // コンテンツ不正はスキップ。infra 障害はここで握りつぶさず再送出する。
        if (error instanceof NoteContentError) {
          skipped.push({ path: group.sourcePath, reason: error.message });
          continue;
        }
        throw error;
      }
    }

    const deleted = await this.deleteRemoved(stored, seen);
    return { processed, deleted, skipped };
  }

  /**
   * 1 ノートを同期する。まず読み取り・検証を済ませ (この間の失敗は content or infra
   * エラーとして送出)、成功したら古いキャッシュを消してから MDAST・アセット・メタデータを
   * 書き込む。D1 upsert を最後に置くことで、途中失敗時も次回 refresh で再処理される。
   */
  private async syncNote(group: NoteGroup): Promise<void> {
    const bytes = await this.content.readFile(group.sourcePath);
    if (bytes === undefined) {
      // ツリーには在るのに読めない = infra 障害。fail-loud で送出。
      throw new Error(`source file could not be read: ${group.sourcePath}`);
    }

    // 検証込みでエンティティと MDAST を組み立てる (不正なら NoteContentError)。
    const { note, mdast } = buildNoteContent(group, bytes);

    // 古いキャッシュ (リネーム・削除されたアセット含む) を消してから書き直す。
    await this.cache.deleteNote(group.slug);
    await this.cache.putMdast(group.slug, mdast);
    await this.cacheAssets(group);
    await this.command.upsert(note);
  }

  private async cacheAssets(group: NoteGroup): Promise<void> {
    for (const asset of group.assets) {
      const bytes = await this.content.readFile(asset.path);
      if (bytes === undefined) continue;
      const relPath = asset.path.slice(group.assetPrefix.length);
      await this.cache.putAsset(group.slug, relPath, {
        bytes,
        contentType: contentTypeForPath(relPath),
      });
    }
  }

  private async deleteRemoved(
    stored: ReadonlyMap<string, string>,
    seen: ReadonlySet<string>,
  ): Promise<string[]> {
    const deleted: string[] = [];
    for (const slug of stored.keys()) {
      if (seen.has(slug)) continue;
      const noteSlug = NoteSlug.create(slug);
      await this.command.deleteBySlug(noteSlug);
      await this.cache.deleteNote(noteSlug);
      deleted.push(slug);
    }
    return deleted;
  }
}

/**
 * ツリーを 1 パスでノード単位 (slug) にまとめる。`notes/<base>.md` を起点にし、
 * `notes/<base>/` 配下のエントリをそのアセットとして束ねる。合成ハッシュも算出する。
 */
function groupNotes(tree: readonly ContentEntry[]): NoteGroup[] {
  const sources: { base: string; entry: ContentEntry }[] = [];
  const assetsByPrefix = new Map<string, ContentEntry[]>();

  for (const entry of tree) {
    if (noteSourcePattern.test(entry.path)) {
      sources.push({
        base: entry.path.slice("notes/".length, -".md".length),
        entry,
      });
    } else if (entry.path.startsWith("notes/")) {
      const prefixEnd = entry.path.indexOf("/", "notes/".length);
      if (prefixEnd === -1) continue;
      const prefix = entry.path.slice(0, prefixEnd + 1);
      const list = assetsByPrefix.get(prefix) ?? [];
      list.push(entry);
      assetsByPrefix.set(prefix, list);
    }
  }

  const groups: NoteGroup[] = [];
  for (const { base, entry } of sources) {
    let slug: NoteSlug;
    try {
      slug = NoteSlug.create(base);
    } catch {
      continue; // slug にできないファイル名は対象外
    }
    const assetPrefix = `notes/${base}/`;
    const assets = assetsByPrefix.get(assetPrefix) ?? [];
    groups.push({
      slug,
      base,
      sourcePath: entry.path,
      assetPrefix,
      assets,
      contentHash: computeContentHash(entry, assets),
    });
  }
  return groups;
}

/** md + アセットの (path, hash) を合成した変更検出用ハッシュ。 */
function computeContentHash(
  source: ContentEntry,
  assets: readonly ContentEntry[],
): string {
  const sortedAssets = assets.toSorted((a, b) => a.path.localeCompare(b.path));
  const parts = [`${source.path}:${source.hash}`];
  for (const asset of sortedAssets) {
    parts.push(`${asset.path}:${asset.hash}`);
  }
  return fnv1a(parts.join("\n"));
}

/** FNV-1a 32-bit ハッシュ (16 進)。変更検出用途に十分。 */
function fnv1a(input: string): string {
  let hash = 0x81_1c_9d_c5;
  for (const ch of input) {
    hash ^= ch.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01_00_01_93);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * バイト列から Note エンティティと MDAST を組み立てる純関数。
 * 不正なフロントマター・VO 検証失敗は {@link NoteContentError} として送出する。
 */
function buildNoteContent(
  group: NoteGroup,
  bytes: Uint8Array,
): { note: Note<IUnpersisted>; mdast: unknown } {
  const parsed = parseNoteContent(new TextDecoder().decode(bytes));
  const slug = group.slug.toString();

  const publishedRaw = parsed.frontmatter.publishedOn;
  if (publishedRaw === undefined) {
    throw new NoteContentError("frontmatter is missing publishedOn");
  }

  try {
    const publishedOn = Temporal.PlainDate.from(publishedRaw);
    const lastModifiedOn = Temporal.PlainDate.from(
      parsed.frontmatter.lastModifiedOn ?? publishedRaw,
    );
    const imageUrl =
      parsed.frontmatter.imageUrl === undefined
        ? undefined
        : ImageUrl.create(resolveAssetUrl(slug, parsed.frontmatter.imageUrl));
    const note = Note.create({
      slug: group.slug,
      title: NoteTitle.create(parsed.frontmatter.title ?? group.base),
      summary: parsed.summary,
      imageUrl,
      publishedOn,
      lastModifiedOn,
      sourceHash: group.contentHash,
    });

    // 本文中の相対画像 URL をアセット API URL に解決してからキャッシュする (ADR 0006)。
    resolveMdastImageUrls(parsed.mdast, slug);
    return { note, mdast: parsed.mdast };
  } catch (error) {
    if (error instanceof NoteContentError) throw error;
    // VO 検証・日付パース失敗はコンテンツ不正として扱う。
    throw new NoteContentError(
      error instanceof Error ? error.message : String(error),
    );
  }
}

interface MdastNodeLike {
  type: string;
  url?: string;
  identifier?: string;
  children?: MdastNodeLike[];
}

/**
 * MDAST を走査し、画像の相対 URL をアセット API URL に書き換える。
 * `image` ノードと、`imageReference` から参照される `definition` のみを対象にし、
 * リンク参照 (linkReference) の definition は書き換えない。
 */
export function resolveMdastImageUrls(node: unknown, slug: string): void {
  const imageRefIds = new Set<string>();
  collectImageReferenceIds(node, imageRefIds);
  rewriteImageUrls(node, slug, imageRefIds);
}

function collectImageReferenceIds(node: unknown, ids: Set<string>): void {
  if (typeof node !== "object" || node === null) return;
  const record = node as MdastNodeLike;
  if (
    record.type === "imageReference" &&
    typeof record.identifier === "string"
  ) {
    ids.add(record.identifier);
  }
  if (Array.isArray(record.children)) {
    for (const child of record.children) collectImageReferenceIds(child, ids);
  }
}

function rewriteImageUrls(
  node: unknown,
  slug: string,
  imageRefIds: ReadonlySet<string>,
): void {
  if (typeof node !== "object" || node === null) return;
  const record = node as MdastNodeLike;
  const isImage = record.type === "image";
  const isImageDefinition =
    record.type === "definition" &&
    typeof record.identifier === "string" &&
    imageRefIds.has(record.identifier);
  if ((isImage || isImageDefinition) && typeof record.url === "string") {
    record.url = resolveAssetUrl(slug, record.url);
  }
  if (Array.isArray(record.children)) {
    for (const child of record.children) {
      rewriteImageUrls(child, slug, imageRefIds);
    }
  }
}
