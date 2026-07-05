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
import { ImageUrl, Note, NoteSlug, NoteTitle } from "~/backend/domain/note";

const noteSourcePattern = /^notes\/[^/]+\.md$/;

/** refresh の実行結果サマリ。 */
export interface RefreshResult {
  /** 再処理した slug。 */
  readonly processed: string[];
  /** 削除した slug (Artifacts から消えたノート)。 */
  readonly deleted: string[];
  /** 不正なフロントマター等でスキップしたファイル。 */
  readonly skipped: { path: string; reason: string }[];
}

interface NoteGroup {
  readonly slug: NoteSlug;
  readonly base: string;
  readonly sourcePath: string;
  readonly hash: string;
  readonly assets: readonly ContentEntry[];
}

/**
 * Artifacts → D1 + R2 のコンテンツ同期サービス。
 *
 * ツリーを取得し blob ハッシュで変更を検出、変わったノートだけ内容を読み直して
 * MDAST を R2 にキャッシュ・メタデータを D1 に upsert・画像を R2 にキャッシュする。
 * Artifacts から消えたノートは D1 / R2 から掃除する (ADR 0005)。
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
    const groups = this.groupNotes(tree);
    const stored = await this.query.listSourceHashes();

    const processed: string[] = [];
    const skipped: { path: string; reason: string }[] = [];
    const seen = new Set<string>();

    for (const group of groups) {
      const slug = group.slug.toString();
      seen.add(slug);
      if (stored.get(slug) === group.hash) continue; // 変更なし
      try {
        await this.processNote(group);
        processed.push(slug);
      } catch (error) {
        skipped.push({
          path: group.sourcePath,
          reason: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const deleted = await this.deleteRemoved(stored, seen);
    return { processed, deleted, skipped };
  }

  /** ツリーをノード単位 (slug) にまとめる。不正な slug の .md は無視する。 */
  private groupNotes(tree: readonly ContentEntry[]): NoteGroup[] {
    const groups: NoteGroup[] = [];
    for (const entry of tree) {
      if (!noteSourcePattern.test(entry.path)) continue;
      const base = entry.path.slice("notes/".length, -".md".length);
      let slug: NoteSlug;
      try {
        slug = NoteSlug.create(base);
      } catch {
        continue; // slug にできないファイル名は対象外
      }
      const assetPrefix = `notes/${base}/`;
      const assets = tree.filter((e) => e.path.startsWith(assetPrefix));
      groups.push({
        slug,
        base,
        sourcePath: entry.path,
        hash: entry.hash,
        assets,
      });
    }
    return groups;
  }

  private async processNote(group: NoteGroup): Promise<void> {
    const bytes = await this.content.readFile(group.sourcePath);
    if (bytes === undefined) {
      throw new Error("source file could not be read");
    }
    const parsed = parseNoteContent(new TextDecoder().decode(bytes));
    const slug = group.slug.toString();

    const publishedRaw = parsed.frontmatter.publishedOn;
    if (publishedRaw === undefined) {
      throw new Error("frontmatter is missing publishedOn");
    }
    const publishedOn = Temporal.PlainDate.from(publishedRaw);
    const lastModifiedOn = Temporal.PlainDate.from(
      parsed.frontmatter.lastModifiedOn ?? publishedRaw,
    );

    const imageUrl =
      parsed.frontmatter.imageUrl === undefined
        ? undefined
        : ImageUrl.create(resolveAssetUrl(slug, parsed.frontmatter.imageUrl));

    // 本文中の相対画像 URL をアセット API URL に解決してからキャッシュする (ADR 0006)。
    resolveMdastImageUrls(parsed.mdast, slug);
    await this.cache.putMdast(group.slug, parsed.mdast);
    await this.cacheAssets(group);

    await this.command.upsert(
      Note.create({
        slug: group.slug,
        title: NoteTitle.create(parsed.frontmatter.title ?? group.base),
        summary: parsed.summary,
        imageUrl,
        publishedOn,
        lastModifiedOn,
        sourceHash: group.hash,
      }),
    );
  }

  private async cacheAssets(group: NoteGroup): Promise<void> {
    const prefix = `notes/${group.base}/`;
    for (const asset of group.assets) {
      const bytes = await this.content.readFile(asset.path);
      if (bytes === undefined) continue;
      const relPath = asset.path.slice(prefix.length);
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

interface MdastNodeLike {
  type: string;
  url?: string;
  children?: MdastNodeLike[];
}

/** MDAST を走査し image / definition の相対 URL をアセット API URL に書き換える。 */
export function resolveMdastImageUrls(node: unknown, slug: string): void {
  if (typeof node !== "object" || node === null) return;
  const record = node as MdastNodeLike;
  if (
    (record.type === "image" || record.type === "definition") &&
    typeof record.url === "string"
  ) {
    record.url = resolveAssetUrl(slug, record.url);
  }
  if (Array.isArray(record.children)) {
    for (const child of record.children) {
      resolveMdastImageUrls(child, slug);
    }
  }
}
