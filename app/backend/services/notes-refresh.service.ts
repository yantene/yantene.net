import { Temporal } from "@js-temporal/polyfill";
import { toString as mdastToString } from "mdast-util-to-string";
import { contentTypeForPath } from "./asset-content-type";
import { readImageDimensions, type ImageDimensions } from "./image-dimensions";
import { MathSyntaxError } from "./latex-to-mathml";
import { resolveAssetUrl } from "./note-asset-url";
import {
  parseNoteContent,
  VisibilityValueError,
  type ParsedNoteContent,
} from "./note-content-parser";
import type { Root } from "mdast";
import type { ContentEntry, IContentStore } from "~/backend/domain/content";
import type {
  INoteCommandRepository,
  INoteContentCache,
  INoteQueryRepository,
  INoteSearchIndex,
} from "~/backend/domain/note";
import type { IUnpersisted } from "~/backend/domain/shared";
import {
  ImageUrl,
  Note,
  NoteSlug,
  NoteTag,
  NoteTitle,
} from "~/backend/domain/note";
import { collectBareLinkUrls } from "~/lib/link-card/bare-link";

const noteSourcePattern = /^notes\/[^/]+\.md$/;

/** refresh の実行結果サマリ。 */
export interface RefreshResult {
  /** 再処理した slug。 */
  readonly processed: string[];
  /** 削除した slug (正本から消えたノート)。 */
  readonly deleted: string[];
  /** 非公開の指定により同期しなかった slug。既に載っていたものは deleted にも入る。 */
  readonly unpublished: string[];
  /** 不正なコンテンツ (フロントマター等) でスキップしたファイル。 */
  readonly skipped: { path: string; reason: string }[];
  /**
   * 再処理した記事が参照しているカード化対象の URL (重複なし)。
   *
   * カードの取得はこのサービスの役目ではない (外部サイトに依存するので失敗の扱いが違う)。
   * 誰が何を参照しているかだけを返し、取りに行くかどうかは Composition Root が決める。
   */
  readonly linkedUrls: string[];
}

export interface RefreshOptions {
  /**
   * コンテンツハッシュが一致していても再処理する。
   *
   * 変更検出は md + アセットのハッシュで行うため、**実装側の変更 (MDAST の作り方を変えた等) は
   * 通常の refresh では既存ノートに反映されない**。そうした移行を流すときに使う。
   */
  readonly force?: boolean;
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

/** 読み取り済みの原文と、その解析結果。読むのは 1 ノートにつき 1 回に留める。 */
interface NoteSource {
  /** フロントマター込みの原文。`/notes/<slug>.md` の配信元として R2 に置く。 */
  readonly markdown: string;
  readonly parsed: ParsedNoteContent;
}

/**
 * 正本 (GitHub) → D1 + R2 のコンテンツ同期サービス。
 *
 * ツリーを取得し、md + アセットの合成ハッシュで変更を検出、変わったノートだけ内容を
 * 読み直して MDAST を R2 にキャッシュ・メタデータを D1 に upsert・画像を R2 にキャッシュ
 * する。正本から消えたノートは D1 / R2 から掃除する (ADR 0004)。
 *
 * コンテンツ不正 (フロントマター欠落等) はスキップして結果に記録するが、infra 障害
 * (正本 / R2 / D1) は握りつぶさず throw する (fail-loud)。
 */
export class NotesRefreshService {
  constructor(
    private readonly content: IContentStore,
    private readonly command: INoteCommandRepository,
    private readonly query: INoteQueryRepository,
    private readonly cache: INoteContentCache,
    private readonly searchIndex: INoteSearchIndex,
  ) {}

  async refresh(options: RefreshOptions = {}): Promise<RefreshResult> {
    const tree = await this.content.listTree();
    const groups = groupNotes(tree);
    const stored = await this.query.listSourceHashes();

    const processed: string[] = [];
    const skipped: { path: string; reason: string }[] = [];
    const unpublished: string[] = [];
    const seen = new Set<string>();
    const linkedUrls = new Set<string>();

    // コンテンツ不正はスキップ。infra 障害はここで握りつぶさず再送出する。
    const attempt = async <T>(
      group: NoteGroup,
      work: () => Promise<T>,
    ): Promise<{ ok: true; value: T } | { ok: false }> => {
      try {
        return { ok: true, value: await work() };
      } catch (error) {
        if (error instanceof NoteContentError) {
          skipped.push({ path: group.sourcePath, reason: error.message });
          return { ok: false };
        }
        throw error;
      }
    };

    for (const group of groups) {
      const slug = group.slug.toString();

      // 変更なしは読まずに飛ばす。force のときは実装変更を既存ノートへ反映するため
      // 読み直す。
      //
      // ハッシュが一致するのは前回同期できたノート、つまり前回は公開だったものに限る
      // (非公開なら D1 に載らず、stored に無いので一致しようがない)。visibility を
      // 書き換えれば contentHash も変わるため、公開 → 非公開の切り替えは必ず下に抜ける。
      const isUnchanged = stored.get(slug) === group.contentHash;
      if (options.force !== true && isUnchanged) {
        seen.add(slug);
        continue;
      }

      const source = await attempt(group, () => this.readNote(group));
      if (!source.ok) continue;

      // 非公開の記事は seen に入れない。正本から消えたノートと同じ経路で
      // D1 と R2 から掃除され、以後どの配信経路にも現れなくなる。
      // 配信側で除外条件を書き足す方式だと、経路が増えるたびに漏れが起きる。
      if (source.value.parsed.frontmatter.visibility === "private") {
        unpublished.push(slug);
        continue;
      }

      seen.add(slug);
      const synced = await attempt(group, () =>
        this.syncNote(group, source.value),
      );
      if (!synced.ok) continue;
      for (const url of synced.value) linkedUrls.add(url);
      processed.push(slug);
    }

    const deleted = await this.deleteRemoved(stored, seen);
    return {
      processed,
      deleted,
      unpublished,
      skipped,
      linkedUrls: [...linkedUrls],
    };
  }

  /**
   * 原文を読んで解析する。書き込みには進まない。
   *
   * 非公開の判定を syncNote の内側に置くと、書き込みを始めてから引き返すことになる。
   * かといって判定のためだけに読み直すと、公開する記事を 2 度読んで 2 度解析すること
   * になる。読むのはここ 1 回にして、結果を syncNote へ渡す。
   */
  private async readNote(group: NoteGroup): Promise<NoteSource> {
    const bytes = await this.content.readFile(group.sourcePath);
    if (bytes === undefined) {
      // ツリーには在るのに読めない = infra 障害。fail-loud で送出。
      throw new Error(`source file could not be read: ${group.sourcePath}`);
    }
    const markdown = new TextDecoder().decode(bytes);
    return { markdown, parsed: parseContent(markdown) };
  }

  /**
   * 1 ノートを同期する。まず読み取り・検証を済ませ (この間の失敗は content or infra
   * エラーとして送出)、成功したら古いキャッシュを消してから原文・MDAST・アセット・
   * メタデータを書き込む。D1 upsert を最後に置くことで、途中失敗時も次回 refresh で
   * 再処理される。
   *
   * 併せて、本文がカード化対象として参照している URL を返す。
   */
  private async syncNote(
    group: NoteGroup,
    source: NoteSource,
  ): Promise<readonly string[]> {
    // 検証込みでエンティティと MDAST を組み立てる (不正なら NoteContentError)。
    const { note, mdast } = buildNoteContent(group, source.parsed);

    // 古いキャッシュ (リネーム・削除されたアセット含む) を消してから書き直す。
    await this.cache.deleteNote(group.slug);
    // 原文はそのまま (フロントマター込み) 置く。`/notes/<slug>.md` の配信元になる。
    await this.cache.putSource(group.slug, source.markdown);
    // アセットを先に処理して寸法を得てから MDAST に埋める (レイアウトシフト対策)。
    const dimensions = await this.cacheAssets(group);
    applyImageDimensions(
      mdast,
      `/api/v1/notes/${group.slug.toString()}/assets/`,
      dimensions,
    );
    await this.cache.putMdast(group.slug, mdast);
    await this.command.upsert(note);
    await this.searchIndex.index({
      slug: group.slug,
      title: note.title.toString(),
      body: mdastToString(mdast),
    });

    return collectBareLinkUrls(mdast);
  }

  /**
   * アセットを R2 に書き込みつつ、画像の寸法を集めて返す。
   * 読めなかった・寸法を判別できなかったものは表に載せない。
   */
  private async cacheAssets(
    group: NoteGroup,
  ): Promise<ReadonlyMap<string, ImageDimensions>> {
    const dimensions = new Map<string, ImageDimensions>();
    for (const asset of group.assets) {
      const bytes = await this.content.readFile(asset.path);
      if (bytes === undefined) continue;
      const relPath = asset.path.slice(group.assetPrefix.length);
      await this.cache.putAsset(group.slug, relPath, {
        bytes,
        contentType: contentTypeForPath(relPath),
      });
      const size = readImageDimensions(bytes);
      if (size !== undefined) dimensions.set(relPath, size);
    }
    return dimensions;
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
      await this.searchIndex.remove(noteSlug);
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
 * Markdown を解析する。読めない LaTeX と読めない visibility はコンテンツ不正として
 * 扱い、そのノートだけをスキップの対象にする (誤字 1 つで refresh 全体を落とさない)。
 * それ以外の失敗はパーサの不具合なので、握りつぶさず送出する。
 */
function parseContent(markdown: string): ParsedNoteContent {
  try {
    return parseNoteContent(markdown);
  } catch (error) {
    if (
      error instanceof MathSyntaxError ||
      error instanceof VisibilityValueError
    ) {
      throw new NoteContentError(error.message);
    }
    throw error;
  }
}

/**
 * 解析済みの本文から Note エンティティと MDAST を組み立てる純関数。
 * 不正なフロントマター・VO 検証失敗は {@link NoteContentError} として送出する。
 */
function buildNoteContent(
  group: NoteGroup,
  parsed: ParsedNoteContent,
): { note: Note<IUnpersisted>; mdast: Root } {
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
      tags: parsed.frontmatter.tags.map((tag) => NoteTag.create(tag)),
      publishedOn,
      lastModifiedOn,
      sourceHash: group.contentHash,
    });

    // 本文中の相対画像 URL をアセット API URL に解決してからキャッシュする (ADR 0005)。
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
  /** mdast-util-to-hast が要素の属性に展開する追加データ (hProperties)。 */
  data?: { hProperties?: Record<string, unknown> };
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

/**
 * MDAST の image ノードに width/height を埋める (レイアウトシフト対策)。
 *
 * `data.hProperties` は mdast-util-to-hast が要素の属性に展開する仕組みなので、
 * フロント側の変更なしに `<img width height>` が出るようになる。
 * 寸法が取れなかった画像には何も付けない (誤った値で見た目を壊さない)。
 *
 * URL は rewriteImageUrls 済み (`/api/v1/notes/<slug>/assets/<path>`) の前提で、
 * そこから相対パスを逆算して寸法表を引く。
 */
function applyImageDimensions(
  node: unknown,
  assetPrefix: string,
  dimensions: ReadonlyMap<string, ImageDimensions>,
): void {
  if (typeof node !== "object" || node === null) return;
  const record = node as MdastNodeLike;
  const isImageLike = record.type === "image" || record.type === "definition";
  if (isImageLike && typeof record.url === "string") {
    const relPath = record.url.startsWith(assetPrefix)
      ? decodeURIComponent(record.url.slice(assetPrefix.length))
      : undefined;
    const size = relPath === undefined ? undefined : dimensions.get(relPath);
    if (size !== undefined) {
      record.data = {
        ...record.data,
        hProperties: {
          ...record.data?.hProperties,
          width: size.width,
          height: size.height,
        },
      };
    }
  }
  if (Array.isArray(record.children)) {
    for (const child of record.children) {
      applyImageDimensions(child, assetPrefix, dimensions);
    }
  }
}
