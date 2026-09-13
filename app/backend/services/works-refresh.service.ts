import type { ImageDimensions } from "./image-dimensions";
import type { ParsedWorkContent } from "./work-content-parser";
import type { ContentEntry, IContentStore } from "~/backend/domain/content";
import type {
  IWorkCommandRepository,
  IWorkContentCache,
  IWorkQueryRepository,
  Work as WorkEntity,
} from "~/backend/domain/work";
import type { IUnpersisted } from "~/backend/domain/shared";
import type { Root } from "mdast";
import { contentTypeForPath } from "./asset-content-type";
import { computeContentHash } from "./content-hash";
import { readImageDimensions } from "./image-dimensions";
import { definitionUrlsOf, withAssetUrls, withImageDimensions } from "./mdast-assets";
import { resolveWorkAssetUrl } from "./work-asset-url";
import { parseWorkContent, WorkContentError } from "./work-content-parser";
import { Work, WorkSlug } from "~/backend/domain/work";
import { collectBareLinkUrls } from "~/lib/link-card/bare-link";

/**
 * コンテンツリポジトリの中で作品が置かれる場所。`works/<slug>.md` と `works/<slug>/<asset>`。
 */
const SOURCE_DIRECTORY = "works/";

/** `works/<base>.md` の形 (直下の .md だけ。`works/<slug>/<file>.md` はアセット)。 */
function isWorkSourcePath(path: string): boolean {
  if (!path.startsWith(SOURCE_DIRECTORY) || !path.endsWith(".md")) return false;
  return !path.slice(SOURCE_DIRECTORY.length).includes("/");
}

/** 作品の同期結果。 */
export interface WorksSyncResult {
  /** 再処理した slug。 */
  readonly processed: string[];
  /** 削除した slug (コンテンツリポジトリから消えた作品)。 */
  readonly deleted: string[];
  /** 不正なコンテンツ (フロントマター等) でスキップしたファイル。 */
  readonly skipped: { path: string; reason: string }[];
  /** 再処理した作品が参照しているカード化対象の URL (重複なし)。 */
  readonly linkedUrls: string[];
}

export interface WorksRefreshOptions {
  /** ハッシュが一致していても読み直す。実装側の変更を既存の作品に反映するとき。 */
  readonly force?: boolean;
}

interface WorkGroup {
  readonly slug: WorkSlug;
  readonly base: string;
  readonly sourcePath: string;
  readonly assetPrefix: string;
  readonly assets: readonly ContentEntry[];
  /** md + 全アセットのハッシュを合成した変更検出用ハッシュ。 */
  readonly contentHash: string;
}

/** 読み取り済みの原文と、その解析結果。読むのは 1 作品につき 1 回に留める。 */
interface WorkSource {
  readonly markdown: string;
  readonly parsed: ParsedWorkContent;
}

/**
 * コンテンツリポジトリ → D1 + R2 の作品同期サービス。
 *
 * 形は記事の同期と同じ。`works/<slug>.md` + `works/<slug>/` の合成ハッシュで変更を
 * 検出し、変わっていれば読み直して MDAST と原文とアセットを R2 に、メタデータを D1 に
 * 書く。コンテンツリポジトリから消えた作品は D1 / R2 から掃除する。
 *
 * 記事との違いは 3 つ。**公開範囲を持たない** (出したくないものは push しない)、
 * **検索の索引と埋め込みを作らない** (探して辿り着くものではない)、**閲覧数を持たない**
 * (消しても取り返しがつかないものが無い)。
 *
 * コンテンツ不正 (フロントマターが読めない等) はその作品だけをスキップして結果に記録し、
 * **前回同期した内容を残す**。infra 障害 (コンテンツリポジトリ / R2 / D1) は握りつぶさず
 * throw する (fail-loud)。
 */
export class WorksRefreshService {
  constructor(
    private readonly content: IContentStore,
    private readonly command: IWorkCommandRepository,
    private readonly query: IWorkQueryRepository,
    private readonly cache: IWorkContentCache,
  ) {}

  async refresh(options: WorksRefreshOptions = {}): Promise<WorksSyncResult> {
    const tree = await this.content.listTree();
    const groups = groupWorks(tree);
    const stored = await this.query.listSourceHashes();

    /*
     * 空のツリーを「全部消してよい」の合図として受け取らない。ブランチの取り違えや
     * コンテンツリポジトリ側の事故で `works/` を持たない応答が返ると、掃除の経路が
     * そのまま全件削除になる。記事のガードと同じ形。
     */
    if (stored.size > 0 && groups.length === 0) {
      throw new Error(
        `refusing to delete all ${stored.size.toString()} work(s): the content tree has no works/*.md`,
      );
    }

    const processed: string[] = [];
    const skipped: { path: string; reason: string }[] = [];
    const seen = new Set<string>();
    const linkedUrls = new Set<string>();

    for (const group of groups) {
      const slug = group.slug.toString();

      // 変更なしは読まずに飛ばす。force のときは実装変更を既存の作品へ反映するため
      // 読み直す。
      if (options.force !== true && stored.get(slug) === group.contentHash) {
        seen.add(slug);
        continue;
      }

      /*
       * 読めなかった作品も seen に入れる。入れ忘れると「コンテンツリポジトリから
       * 消えた作品」と同じ経路で D1・R2 から消え、誤字 1 つで出ている作品が落ちる。
       */
      seen.add(slug);
      try {
        for (const url of await this.syncWork(group)) linkedUrls.add(url);
        processed.push(slug);
      } catch (error) {
        if (!(error instanceof WorkContentError)) throw error;
        skipped.push({ path: group.sourcePath, reason: error.message });
      }
    }

    return {
      processed,
      deleted: await this.deleteRemoved(stored, seen),
      skipped,
      linkedUrls: [...linkedUrls],
    };
  }

  /**
   * 1 作品を同期する。まず読み取り・検証を済ませ、成功したら R2 へ書き、行き場を
   * 失ったアセットを片付け、最後に D1 を更新する。
   *
   * **D1 の upsert を最後に置くのが肝。** contentHash が入った時点でその作品は
   * 「同期済み」になり、次の refresh は読まずに飛ばす。だから upsert より前に
   * 済ませておかないものは、失敗しても二度と直らない (記事と同じ決め)。
   */
  private async syncWork(group: WorkGroup): Promise<readonly string[]> {
    const source = await this.readWork(group);
    // 書き始める前に検証を終える。途中で引き返すと、R2 だけが新しい姿になる。
    const { work, mdast } = buildWorkContent(group, source.parsed);

    // アセットを先に処理して寸法を得てから MDAST に埋める (レイアウトシフト対策)。
    const dimensions = await this.cacheAssets(group);
    const sized = withImageDimensions(mdast, dimensions, definitionUrlsOf(mdast));

    await this.cache.putMdast(group.slug, sized);
    await this.cache.putSource(group.slug, source.markdown);
    /*
     * 片付けは D1 の upsert より前に置く。後ろだと、片付けに失敗したときに
     * contentHash だけが新しくなり、行き場を失った写しが次の refresh でも拾われない。
     */
    await this.cache.pruneAssets(group.slug, assetPathsOf(group));
    await this.command.upsert(work);

    return collectBareLinkUrls(sized);
  }

  /** 原文を読んで解析する。書き込みには進まない。 */
  private async readWork(group: WorkGroup): Promise<WorkSource> {
    const bytes = await this.content.readFile(group.sourcePath);
    if (bytes === undefined) {
      // ツリーには在るのに読めない = infra 障害。fail-loud で送出。
      throw new Error(`source file could not be read: ${group.sourcePath}`);
    }
    const markdown = new TextDecoder().decode(bytes);
    return { markdown, parsed: parseWorkContent(markdown) };
  }

  /**
   * アセットを R2 に書き込みつつ、画像の寸法を集めて返す。
   * 読めなかった・寸法を判別できなかったものは表に載せない。
   */
  private async cacheAssets(group: WorkGroup): Promise<ReadonlyMap<string, ImageDimensions>> {
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
      // キーは解決後の URL。本文の側も同じ解決を通るので、符号化の揺れを気にせず
      // 突き合わせられる (#297)。
      if (size !== undefined) {
        dimensions.set(resolveWorkAssetUrl(group.slug.toString(), relPath), size);
      }
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
      const workSlug = WorkSlug.create(slug);
      await this.command.deleteBySlug(workSlug);
      await this.cache.deleteWork(workSlug);
      deleted.push(slug);
    }
    return deleted;
  }
}

/**
 * ツリーを 1 パスで作品単位 (slug) にまとめる。`works/<base>.md` を起点にし、
 * `works/<base>/` 配下のエントリをそのアセットとして束ねる。合成ハッシュも算出する。
 */
function groupWorks(tree: readonly ContentEntry[]): WorkGroup[] {
  const sources: { base: string; entry: ContentEntry }[] = [];
  const assetsByPrefix = new Map<string, ContentEntry[]>();

  for (const entry of tree) {
    if (isWorkSourcePath(entry.path)) {
      sources.push({ base: entry.path.slice(SOURCE_DIRECTORY.length, -".md".length), entry });
    } else if (entry.path.startsWith(SOURCE_DIRECTORY)) {
      const prefixEnd = entry.path.indexOf("/", SOURCE_DIRECTORY.length);
      if (prefixEnd === -1) continue;
      const prefix = entry.path.slice(0, prefixEnd + 1);
      const list = assetsByPrefix.get(prefix) ?? [];
      list.push(entry);
      assetsByPrefix.set(prefix, list);
    }
  }

  const groups: WorkGroup[] = [];
  for (const { base, entry } of sources) {
    const slug = WorkSlug.parse(base);
    if (slug === undefined) continue; // slug にできないファイル名は対象外
    const assetPrefix = `${SOURCE_DIRECTORY}${base}/`;
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

/** その作品がコンテンツリポジトリに持っているアセットの相対パス。 */
function assetPathsOf(group: WorkGroup): ReadonlySet<string> {
  return new Set(group.assets.map((asset) => asset.path.slice(group.assetPrefix.length)));
}

/**
 * 解析済みの内容から Work エンティティと MDAST を組み立てる純関数。
 * VO 検証の失敗はコンテンツ不正として送出する。
 */
function buildWorkContent(
  group: WorkGroup,
  parsed: ParsedWorkContent,
): { work: WorkEntity<IUnpersisted>; mdast: Root } {
  const slug = group.slug.toString();
  const work = Work.create({
    slug: group.slug,
    name: parsed.name,
    summary: parsed.summary,
    url: parsed.url,
    position: parsed.position,
    sourceHash: group.contentHash,
  });

  // 本文中の相対 URL をアセット API URL に解決してからキャッシュする (ADR 0005)。
  return { work, mdast: withAssetUrls(parsed.mdast, (url) => resolveWorkAssetUrl(slug, url)) };
}
