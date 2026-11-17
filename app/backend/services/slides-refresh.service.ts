import type { ImageDimensions } from "./image-dimensions";
import type { ParsedSlideContent } from "./slide-content-parser";
import type { ContentEntry, IContentStore } from "~/backend/domain/content";
import type {
  ISlideCommandRepository,
  ISlideContentCache,
  ISlideQueryRepository,
} from "~/backend/domain/slide";
import type { IUnpersisted } from "~/backend/domain/shared";
import type { Root } from "mdast";
import { contentTypeForPath } from "./asset-content-type";
import { isSyncedAssetPath } from "./content-asset-path";
import { computeContentHash } from "./content-hash";
import { readImageDimensions } from "./image-dimensions";
import { definitionUrlsOf, withAssetUrls, withImageDimensions } from "./mdast-assets";
import { resolveSlideAssetUrl } from "./slide-asset-url";
import { parseSlideContent, SlideContentError, summarizeNarration } from "./slide-content-parser";
import { Slide, SlideSlug } from "~/backend/domain/slide";
import { collectBareLinkUrls } from "~/lib/link-card/bare-link";
import { paginate } from "~/lib/slides/deck";
import { findOverfull } from "~/lib/slides/overfull";

/**
 * コンテンツリポジトリの中でスライドが置かれる場所。`slides/<slug>.md` と
 * `slides/<slug>/<asset>`。
 */
const SOURCE_DIRECTORY = "slides/";

/** `slides/<base>.md` の形 (直下の .md だけ。`slides/<slug>/<file>.md` はアセット)。 */
function isSlideSourcePath(path: string): boolean {
  if (!path.startsWith(SOURCE_DIRECTORY) || !path.endsWith(".md")) return false;
  return !path.slice(SOURCE_DIRECTORY.length).includes("/");
}

function sourcePathOf(slug: string): string {
  return `${SOURCE_DIRECTORY}${slug}.md`;
}

/** スライドの同期結果。 */
export interface SlidesSyncResult {
  /** 再処理した slug。 */
  readonly processed: string[];
  /** 削除した slug (コンテンツリポジトリから消えたスライド)。 */
  readonly deleted: string[];
  /** 不正なコンテンツ (フロントマター等) でスキップしたファイル。 */
  readonly skipped: { path: string; reason: string }[];
  /**
   * 同期はしたが、書き手に直してほしいこと。いまは「1 ページに入りきらない量」
   * (Overfull。ADR 0052) と、本文の写しが欠けていること。
   *
   * **今回読み直したスライドに限らず、保存されている全スライドについて毎回出す。**
   * 読み直したものだけに出すと、次の push で警告が消えて、直っていない量が直ったように
   * 見える (作品の警告と同じ決め)。
   */
  readonly warnings: { path: string; reason: string }[];
  /** 再処理したスライドが参照しているカード化対象の URL (重複なし)。 */
  readonly linkedUrls: string[];
}

export interface SlidesRefreshOptions {
  /** ハッシュが一致していても読み直す。実装側の変更を既存のスライドに反映するとき。 */
  readonly force?: boolean;
}

interface SlideGroup {
  readonly slug: SlideSlug;
  readonly sourcePath: string;
  readonly assetPrefix: string;
  readonly assets: readonly ContentEntry[];
  /** md + 全アセットのハッシュを合成した変更検出用ハッシュ。 */
  readonly contentHash: string;
}

/** 読み取り済みの原文と、その解析結果。読むのは 1 スライドにつき 1 回に留める。 */
interface SlideSource {
  readonly markdown: string;
  readonly parsed: ParsedSlideContent;
}

/**
 * コンテンツリポジトリ → D1 + R2 のスライド同期サービス。
 *
 * 形は作品の同期と同じ。`slides/<slug>.md` + `slides/<slug>/` の合成ハッシュで変更を
 * 検出し、変わっていれば読み直して MDAST と原文とアセットを R2 に、メタデータを D1 に
 * 書く。コンテンツリポジトリから消えたスライドは D1 / R2 から掃除する。
 *
 * 公開範囲は記事と同じ `status` で持つ。**どの status のスライドも同期する** (ADR 0040)。
 * 読み手から隠すのは配信の時点なので、ここに渡す読み取り口は `forAdmin` であること
 * (読み手向けを渡すと、下書きが「D1 に無い」ように見えて毎回読み直され、消えた下書きが
 * 掃除されない)。作品と同じく検索の索引と埋め込みは作らない。
 *
 * コンテンツ不正 (フロントマターが読めない等) はそのスライドだけをスキップして結果に
 * 記録し、**前回同期した内容を残す**。infra 障害 (コンテンツリポジトリ / R2 / D1) は
 * 握りつぶさず throw する (fail-loud)。
 *
 * **量が多すぎるページは止めない。** 警告として結果に載せ、スライドは同期する
 * (LaTeX の Overfull \hbox と同じ扱い。ADR 0052)。
 */
export class SlidesRefreshService {
  constructor(
    private readonly content: IContentStore,
    private readonly command: ISlideCommandRepository,
    private readonly query: ISlideQueryRepository,
    private readonly cache: ISlideContentCache,
  ) {}

  async refresh(options: SlidesRefreshOptions = {}): Promise<SlidesSyncResult> {
    const tree = await this.content.listTree();
    const groups = groupSlides(tree);
    const stored = await this.query.listSourceHashes();

    /*
     * 空のツリーを「全部消してよい」の合図として受け取らない。ブランチの取り違えや
     * コンテンツリポジトリ側の事故で `slides/` を持たない応答が返ると、掃除の経路が
     * そのまま全件削除になる。記事・作品のガードと同じ形。
     */
    if (stored.size > 0 && groups.length === 0) {
      throw new Error(
        `refusing to delete all ${stored.size.toString()} slide(s): the content tree has no slides/*.md`,
      );
    }

    const processed: string[] = [];
    const skipped: { path: string; reason: string }[] = [];
    const seen = new Set<string>();
    const linkedUrls = new Set<string>();

    for (const group of groups) {
      const slug = group.slug.toString();

      // 変更なしは読まずに飛ばす。force のときは実装変更を既存のスライドへ反映するため
      // 読み直す。
      if (options.force !== true && stored.get(slug) === group.contentHash) {
        seen.add(slug);
        continue;
      }

      /*
       * 読めなかったスライドも seen に入れる。入れ忘れると「コンテンツリポジトリから
       * 消えたスライド」と同じ経路で D1・R2 から消え、誤字 1 つで出ているものが落ちる。
       */
      seen.add(slug);
      try {
        for (const url of await this.syncSlide(group)) linkedUrls.add(url);
        processed.push(slug);
      } catch (error) {
        if (!(error instanceof SlideContentError)) throw error;
        skipped.push({ path: group.sourcePath, reason: error.message });
      }
    }

    const deleted = await this.deleteRemoved(stored, seen);
    return {
      processed,
      deleted,
      skipped,
      warnings: await this.findOverfullPages(),
      linkedUrls: [...linkedUrls],
    };
  }

  /**
   * 保存されている全スライドについて、1 ページに入りきらない量を警告にする。
   *
   * 見るのは **R2 に置いてある MDAST そのもの** (読み手に描くのと同じ木)。今回読み直さ
   * なかったスライドのぶんも出したいので、手元の解析結果ではなく写しを読む。スライドの
   * 数だけ R2 を読むことになるが、数本から数十本のものなので同期の中では軽い。
   *
   * D1 に在るのに MDAST が無いスライドは、**ここでは投げずに警告にする**。ページの
   * loader は同じ不整合で投げる (fail-loud) が、ここで投げると 1 本の欠けでほかの
   * 種別の同期まで止まり、直す手立て (force refresh) も同じ所で落ちる。
   */
  private async findOverfullPages(): Promise<{ path: string; reason: string }[]> {
    const warnings: { path: string; reason: string }[] = [];
    for (const slide of await this.query.list()) {
      const path = sourcePathOf(slide.slug.toString());
      const mdast = await this.cache.getMdast(slide.slug);
      if (mdast === undefined) {
        warnings.push({ path, reason: "MDAST cache is missing; run a force refresh" });
        continue;
      }
      for (const warning of findOverfull(paginate(mdast as Root))) {
        warnings.push({ path, reason: `page ${String(warning.page)}: ${warning.reason}` });
      }
    }
    return warnings;
  }

  /**
   * 1 スライドを同期する。まず読み取り・検証を済ませ、成功したら R2 へ書き、行き場を
   * 失ったアセットを片付け、最後に D1 を更新する。
   *
   * **D1 の upsert を最後に置くのが肝。** contentHash が入った時点でそのスライドは
   * 「同期済み」になり、次の refresh は読まずに飛ばす。だから upsert より前に
   * 済ませておかないものは、失敗しても二度と直らない (記事・作品と同じ決め)。
   */
  private async syncSlide(group: SlideGroup): Promise<readonly string[]> {
    const source = await this.readSlide(group);
    const slug = group.slug.toString();
    // 本文中の相対 URL をアセット API URL に解決する (ADR 0005)。
    const mdast = withAssetUrls(source.parsed.mdast, (url) => resolveSlideAssetUrl(slug, url));

    // アセットを先に処理して寸法を得てから MDAST に埋める。寸法はレイアウトシフト対策に
    // 加えて、図の置き方 (縦横比で上下か左右か) を決めるのにも使う (`deck.ts`)。
    const dimensions = await this.cacheAssets(group);
    const sized = withImageDimensions(mdast, dimensions, definitionUrlsOf(mdast));

    await this.cache.putMdast(group.slug, sized);
    await this.cache.putSource(group.slug, source.markdown);
    /*
     * 片付けは D1 の upsert より前に置く。後ろだと、片付けに失敗したときに
     * contentHash だけが新しくなり、行き場を失った写しが次の refresh でも拾われない。
     */
    await this.cache.pruneAssets(group.slug, assetPathsOf(group));
    await this.command.upsert(buildSlide(group, source.parsed, sized));

    return collectBareLinkUrls(sized);
  }

  /** 原文を読んで解析する。書き込みには進まない。 */
  private async readSlide(group: SlideGroup): Promise<SlideSource> {
    const bytes = await this.content.readFile(group.sourcePath);
    if (bytes === undefined) {
      // ツリーには在るのに読めない = infra 障害。fail-loud で送出。
      throw new Error(`source file could not be read: ${group.sourcePath}`);
    }
    const markdown = new TextDecoder().decode(bytes);
    return { markdown, parsed: parseSlideContent(markdown) };
  }

  /**
   * アセットを R2 に書き込みつつ、画像の寸法を集めて返す。
   * 読めなかった・寸法を判別できなかったものは表に載せない。
   */
  private async cacheAssets(group: SlideGroup): Promise<ReadonlyMap<string, ImageDimensions>> {
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
        dimensions.set(resolveSlideAssetUrl(group.slug.toString(), relPath), size);
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
      const slideSlug = SlideSlug.create(slug);
      await this.command.deleteBySlug(slideSlug);
      await this.cache.deleteSlide(slideSlug);
      deleted.push(slug);
    }
    return deleted;
  }
}

/**
 * ツリーを 1 パスでスライド単位 (slug) にまとめる。`slides/<base>.md` を起点にし、
 * `slides/<base>/` 配下のエントリをそのアセットとして束ねる。合成ハッシュも算出する。
 * `_` で始まる要素を含むパスは束ねない (`isSyncedAssetPath`)。
 */
function groupSlides(tree: readonly ContentEntry[]): SlideGroup[] {
  const sources: { base: string; entry: ContentEntry }[] = [];
  const assetsByPrefix = new Map<string, ContentEntry[]>();

  for (const entry of tree) {
    if (isSlideSourcePath(entry.path)) {
      sources.push({ base: entry.path.slice(SOURCE_DIRECTORY.length, -".md".length), entry });
    } else if (entry.path.startsWith(SOURCE_DIRECTORY)) {
      const prefixEnd = entry.path.indexOf("/", SOURCE_DIRECTORY.length);
      if (prefixEnd === -1) continue;
      const prefix = entry.path.slice(0, prefixEnd + 1);
      if (!isSyncedAssetPath(entry.path.slice(prefix.length))) continue;
      const list = assetsByPrefix.get(prefix) ?? [];
      list.push(entry);
      assetsByPrefix.set(prefix, list);
    }
  }

  const groups: SlideGroup[] = [];
  for (const { base, entry } of sources) {
    const slug = SlideSlug.parse(base);
    if (slug === undefined) continue; // slug にできないファイル名は対象外
    const assetPrefix = `${SOURCE_DIRECTORY}${base}/`;
    const assets = assetsByPrefix.get(assetPrefix) ?? [];
    groups.push({
      slug,
      sourcePath: entry.path,
      assetPrefix,
      assets,
      contentHash: computeContentHash(entry, assets),
    });
  }
  return groups;
}

/** そのスライドがコンテンツリポジトリに持っているアセットの相対パス。 */
function assetPathsOf(group: SlideGroup): ReadonlySet<string> {
  return new Set(group.assets.map((asset) => asset.path.slice(group.assetPrefix.length)));
}

/**
 * 解析済みの内容から Slide エンティティを組み立てる純関数。
 *
 * ページの数は **R2 に書いたのと同じ木** (`mdast`) を切って数える。別の木から数えると、
 * 一覧の「N ページ」と開いたときのページ数がずれうる。
 */
function buildSlide(
  group: SlideGroup,
  parsed: ParsedSlideContent,
  mdast: Root,
): Slide<IUnpersisted> {
  return Slide.create({
    slug: group.slug,
    title: parsed.title,
    publishedOn: parsed.publishedOn,
    event: parsed.event,
    summary: summarizeNarration(mdast),
    pageCount: paginate(mdast).pages.length,
    // status で分岐しない。どの段階のスライドも同期し、隠すのは配信の時点 (ADR 0040)。
    status: parsed.status,
    sourceHash: group.contentHash,
  });
}
