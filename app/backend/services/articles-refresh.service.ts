import { Temporal } from "@js-temporal/polyfill";
import { toString as mdastToString } from "mdast-util-to-string";
import { contentTypeForPath } from "./asset-content-type";
import { computeContentHash } from "./content-hash";
import { definitionUrlsOf, withAssetUrls, withImageDimensions } from "./mdast-assets";
import { readImageDimensions, type ImageDimensions } from "./image-dimensions";
import { MathSyntaxError } from "./latex-to-mathml";
import { resolveAssetUrl } from "./article-asset-url";
import {
  parseArticleContent,
  StatusValueError,
  type ParsedArticleContent,
} from "./article-content-parser";
import type { Root } from "mdast";
import type { ContentEntry, IContentStore } from "~/backend/domain/content";
import type {
  IArticleCommandRepository,
  IArticleContentCache,
  IArticleQueryRepository,
  IArticleSearchIndex,
} from "~/backend/domain/article";
import type { IUnpersisted } from "~/backend/domain/shared";
import {
  ImageUrl,
  Article,
  ArticleSlug,
  ArticleTitle,
  isListedToReaders,
} from "~/backend/domain/article";
import { collectBareLinkUrls } from "~/lib/link-card/bare-link";

/**
 * コンテンツリポジトリの中で記事が置かれる場所。`articles/<slug>.md` と `articles/<slug>/<asset>`。
 *
 * `notes/` は短文の投稿のために空けてある。コンテンツリポジトリ側が `articles/` を持たないまま refresh を
 * 叩くと、下の「全件削除の拒否」で止まる。
 */
const SOURCE_DIRECTORY = "articles/";

/** `articles/<base>.md` の形 (直下の .md だけ。`articles/<slug>/<file>.md` はアセット)。 */
function isArticleSourcePath(path: string): boolean {
  if (!path.startsWith(SOURCE_DIRECTORY) || !path.endsWith(".md")) return false;
  return !path.slice(SOURCE_DIRECTORY.length).includes("/");
}

/** refresh の実行結果サマリ。 */
export interface RefreshResult {
  /** 再処理した slug。 */
  readonly processed: string[];
  /** 削除した slug (コンテンツリポジトリから消えた記事)。 */
  readonly deleted: string[];
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
   * 通常の refresh では既存記事に反映されない**。そうした移行を流すときに使う。
   */
  readonly force?: boolean;
}

interface ArticleGroup {
  readonly slug: ArticleSlug;
  readonly base: string;
  readonly sourcePath: string;
  readonly assetPrefix: string;
  readonly assets: readonly ContentEntry[];
  /** md + 全アセットのハッシュを合成した変更検出用ハッシュ。 */
  readonly contentHash: string;
}

/** コンテンツ由来のエラー (フロントマター不正等)。infra エラーと区別してスキップ扱いにする。 */
class ArticleContentError extends Error {
  readonly name = "ArticleContentError";
}

/** 読み取り済みの原文と、その解析結果。読むのは 1 記事につき 1 回に留める。 */
interface ArticleSource {
  /** フロントマター込みの原文。`/articles/<slug>.md` の配信元として R2 に置く。 */
  readonly markdown: string;
  readonly parsed: ParsedArticleContent;
}

/**
 * コンテンツリポジトリ → D1 + R2 のコンテンツ同期サービス。
 *
 * ツリーを取得し、md + アセットの合成ハッシュで変更を検出、変わった記事だけ内容を
 * 読み直して MDAST を R2 にキャッシュ・メタデータを D1 に upsert・画像を R2 にキャッシュ
 * する。コンテンツリポジトリから消えた記事は D1 / R2 から掃除する (ADR 0004)。
 *
 * コンテンツ不正 (フロントマター欠落等) はその記事だけをスキップして結果に記録する。
 * スキップした記事は掃除の対象にせず、前回同期した内容を残す (誤字 1 つで公開中の
 * 記事を消さない)。infra 障害 (コンテンツリポジトリ / R2 / D1) は握りつぶさず throw する (fail-loud)。
 */
export class ArticlesRefreshService {
  constructor(
    private readonly content: IContentStore,
    private readonly command: IArticleCommandRepository,
    private readonly query: IArticleQueryRepository,
    private readonly cache: IArticleContentCache,
    private readonly searchIndex: IArticleSearchIndex,
  ) {}

  async refresh(options: RefreshOptions = {}): Promise<RefreshResult> {
    const tree = await this.content.listTree();
    const groups = groupArticles(tree);
    const stored = await this.query.listSourceHashes();

    // 空のツリーを「全部消してよい」の合図として受け取らない。ブランチの取り違えや
    // コンテンツリポジトリ側の事故で articles/ を持たない応答が返ると、掃除の経路がそのまま全件削除に
    // なる。閲覧数も届いた Webmention もコンテンツリポジトリには無いので、消したら戻せない。
    // 既に何件か載っているのに 1 件も見つからないのは、同期ではなく事故である。
    //
    // status を何にしても、ここには掛からない。どの status の記事も同期するので
    // groups にも stored にも載る (ADR 0040)。掛かるのはコンテンツリポジトリの側が
    // 空に見えるときだけ。
    if (stored.size > 0 && groups.length === 0) {
      throw new Error(
        `refusing to delete all ${stored.size.toString()} article(s): the content tree has no articles/*.md`,
      );
    }

    const processed: string[] = [];
    const skipped: { path: string; reason: string }[] = [];
    const seen = new Set<string>();
    const linkedUrls = new Set<string>();

    // コンテンツ不正はスキップ。infra 障害はここで握りつぶさず再送出する。
    const attempt = async <T>(
      group: ArticleGroup,
      work: () => Promise<T>,
    ): Promise<{ ok: true; value: T } | { ok: false }> => {
      try {
        return { ok: true, value: await work() };
      } catch (error) {
        if (error instanceof ArticleContentError) {
          skipped.push({ path: group.sourcePath, reason: error.message });
          return { ok: false };
        }
        throw error;
      }
    };

    for (const group of groups) {
      const slug = group.slug.toString();

      // 変更なしは読まずに飛ばす。force のときは実装変更を既存記事へ反映するため
      // 読み直す。
      //
      // どの status の記事も D1 に載るので、ハッシュが一致するのは「前回も同じ中身で
      // 同期できた記事」という意味しか持たない。status を書き換えれば contentHash も
      // 変わるため、段階の移り変わりは必ず下に抜ける。
      const isUnchanged = stored.get(slug) === group.contentHash;
      if (options.force !== true && isUnchanged) {
        seen.add(slug);
        continue;
      }

      const source = await attempt(group, () => this.readArticle(group));
      if (!source.ok) {
        // 読めなかった理由はコンテンツ不正 (読めない LaTeX / 読めない status / 旧書式の
        // visibility の残り) に限られる。infra 障害は attempt が握らずに送出するので
        // ここには来ない。
        // つまり記事自体はコンテンツリポジトリに在るので、seen に入れて掃除の対象から外す。
        // 入れ忘れると「コンテンツリポジトリから消えた記事」と同じ経路で D1・R2 から消え、閲覧数も
        // 届いた Webmention も道連れになる。Webmention はコンテンツリポジトリのどこにも無いので戻せない。
        //
        // 読み取りの後で落ちる不正 (publishedOn 欠落など) は seen.add より後の
        // buildArticleContent で起きるため元から旧版が残る。この分岐だけが非対称だった。
        seen.add(slug);
        continue;
      }

      // status で分岐しない。**どの段階の記事も同期する** (ADR 0040)。読み手から
      // 隠すのは配信の時点で行う (D1ArticleQueryRepository.forReaders)。
      //
      // 同期しない方式だと、取り下げた記事に届いていた Webmention と閲覧数が戻らない。
      // どちらもコンテンツリポジトリのどこにも無いので、消したら復元できない。
      seen.add(slug);
      const synced = await attempt(group, () => this.syncArticle(group, source.value));
      if (!synced.ok) continue;
      for (const url of synced.value) linkedUrls.add(url);
      processed.push(slug);
    }

    const deleted = await this.deleteRemoved(stored, seen);
    return {
      processed,
      deleted,
      skipped,
      linkedUrls: [...linkedUrls],
    };
  }

  /**
   * 原文を読んで解析する。書き込みには進まない。
   *
   * 読むのは 1 記事につき 1 回。結果をそのまま syncArticle へ渡す。
   */
  private async readArticle(group: ArticleGroup): Promise<ArticleSource> {
    const bytes = await this.content.readFile(group.sourcePath);
    if (bytes === undefined) {
      // ツリーには在るのに読めない = infra 障害。fail-loud で送出。
      throw new Error(`source file could not be read: ${group.sourcePath}`);
    }
    const markdown = new TextDecoder().decode(bytes);
    return { markdown, parsed: parseContent(markdown) };
  }

  /**
   * 1 記事を同期する。まず読み取り・検証を済ませ (この間の失敗は content or infra
   * エラーとして送出)、成功したら R2 へ書き、行き場を失ったアセットを片付け、最後に
   * D1 を更新する。
   *
   * **D1 の upsert を最後に置くのが肝。** contentHash が入った時点でその記事は
   * 「同期済み」になり、次の refresh は読まずに飛ばす。だから upsert より前に済ませて
   * おかないものは、失敗しても二度と直らない。
   *
   * 併せて、本文がカード化対象として参照している URL を返す。
   */
  private async syncArticle(
    group: ArticleGroup,
    source: ArticleSource,
  ): Promise<readonly string[]> {
    // 検証込みでエンティティと MDAST を組み立てる (不正なら ArticleContentError)。
    const { article, mdast } = buildArticleContent(group, source.parsed);

    /*
     * **書いてから片付ける。** 先に消す形だと、途中で落ちたときにその記事が消えたまま
     * 残り、D1 に行があるのに R2 に MDAST が無い状態になる (記事ページが 500)。しかも
     * 落ちた原因がファイル名のような固定のものだと、毎回同じ場所で死んで直らない (#310)。
     *
     * 原文と MDAST はキーが決まっているので上書きで足りる。消す必要があるのは、リネーム
     * ・削除されて**行き場を失ったアセット**だけ。
     */
    // アセットを先に処理して寸法を得てから MDAST に埋める (レイアウトシフト対策)。
    const dimensions = await this.cacheAssets(group);
    const sized = withImageDimensions(mdast, dimensions, definitionUrlsOf(mdast));
    /*
     * 本文の 2 つの姿 (MDAST と原文) は隣り合わせに書く。同じ URL の 2 表現なので
     * (ADR 0020)、間に他の書き込みを挟むと、途中で落ちたときに**記事ページと
     * `/articles/<slug>.md` が違う版を出す**時間が延びる。
     */
    await this.cache.putMdast(group.slug, sized);
    // 原文はそのまま (フロントマター込み) 置く。`/articles/<slug>.md` の配信元になる。
    await this.cache.putSource(group.slug, source.markdown);
    /*
     * 片付けは D1 の upsert より前に置く。後ろだと、片付けに失敗したときに
     * contentHash だけが新しくなり、行き場を失った写しが次の refresh でも拾われない。
     *
     * 残す一覧は「コンテンツリポジトリにあるアセット」であって「今回書けたもの」ではない。読めなかった
     * アセットまで消すと、一時的な失敗で前回の写しを落とすことになる。
     */
    await this.cache.pruneAssets(group.slug, assetPathsOf(group));
    /*
     * 検索の索引も upsert より前。後ろだと、索引の更新に失敗したときに contentHash
     * だけが新しくなり、**次の refresh がこの記事を読まずに飛ばす**ので索引が古い
     * まま固まる。force を流すまで直らず、直す必要があることも表に出ない。
     */
    /*
     * 索引に入れるのは `published` だけ (ADR 0040)。
     *
     * 索引はリポジトリを通らずに D1 を直接引かれるので、ここを素通りさせると
     * **上位 N 件を下書きが埋めてから forReaders が落とす**ことになり、検索結果が
     * N 件に足りなくなる。絞るのは読み取りではなく、索引に入れる時点。
     *
     * 公開 → 取り下げの向きも拾う。段階が変われば contentHash も変わるのでここへ
     * 来る。落とさないと、取り下げた記事が検索から出続ける。
     */
    if (isListedToReaders(article.status)) {
      await this.searchIndex.index({
        slug: group.slug,
        title: article.title.toString(),
        body: mdastToString(sized),
      });
    } else {
      await this.searchIndex.remove(group.slug);
    }
    await this.command.upsert(article);

    return collectBareLinkUrls(sized);
  }

  /**
   * アセットを R2 に書き込みつつ、画像の寸法を集めて返す。
   * 読めなかった・寸法を判別できなかったものは表に載せない。
   */
  private async cacheAssets(group: ArticleGroup): Promise<ReadonlyMap<string, ImageDimensions>> {
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
      /*
       * キーは**解決後の URL**。本文の側も同じ resolveAssetUrl を通るので、符号化の
       * 揺れ (`絵.png` → `%E7%B5%B5.png`、`100%25.png` はそのまま) を気にせず突き合わせ
       * られる。URL から名前へ戻す方向だと、`%25` を含む名前が別物に化ける (#297)。
       */
      if (size !== undefined) {
        dimensions.set(resolveAssetUrl(group.slug.toString(), relPath), size);
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
      const articleSlug = ArticleSlug.create(slug);
      await this.command.deleteBySlug(articleSlug);
      await this.cache.deleteArticle(articleSlug);
      await this.searchIndex.remove(articleSlug);
      deleted.push(slug);
    }
    return deleted;
  }
}

/**
 * ツリーを 1 パスでノード単位 (slug) にまとめる。`articles/<base>.md` を起点にし、
 * `articles/<base>/` 配下のエントリをそのアセットとして束ねる。合成ハッシュも算出する。
 */
function groupArticles(tree: readonly ContentEntry[]): ArticleGroup[] {
  const sources: { base: string; entry: ContentEntry }[] = [];
  const assetsByPrefix = new Map<string, ContentEntry[]>();

  for (const entry of tree) {
    if (isArticleSourcePath(entry.path)) {
      sources.push({
        base: entry.path.slice(SOURCE_DIRECTORY.length, -".md".length),
        entry,
      });
    } else if (entry.path.startsWith(SOURCE_DIRECTORY)) {
      const prefixEnd = entry.path.indexOf("/", SOURCE_DIRECTORY.length);
      if (prefixEnd === -1) continue;
      const prefix = entry.path.slice(0, prefixEnd + 1);
      const list = assetsByPrefix.get(prefix) ?? [];
      list.push(entry);
      assetsByPrefix.set(prefix, list);
    }
  }

  const groups: ArticleGroup[] = [];
  for (const { base, entry } of sources) {
    let slug: ArticleSlug;
    try {
      slug = ArticleSlug.create(base);
    } catch {
      continue; // slug にできないファイル名は対象外
    }
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

/** その記事がコンテンツリポジトリに持っているアセットの相対パス。 */
function assetPathsOf(group: ArticleGroup): ReadonlySet<string> {
  return new Set(group.assets.map((asset) => asset.path.slice(group.assetPrefix.length)));
}

/**
 * Markdown を解析する。読めない LaTeX と読めない status はコンテンツ不正として
 * 扱い、その記事だけをスキップの対象にする (誤字 1 つで refresh 全体を落とさない)。
 * それ以外の失敗はパーサの不具合なので、握りつぶさず送出する。
 */
function parseContent(markdown: string): ParsedArticleContent {
  try {
    return parseArticleContent(markdown);
  } catch (error) {
    if (error instanceof MathSyntaxError || error instanceof StatusValueError) {
      throw new ArticleContentError(error.message);
    }
    throw error;
  }
}

/**
 * 解析済みの本文から Article エンティティと MDAST を組み立てる純関数。
 * 不正なフロントマター・VO 検証失敗は {@link ArticleContentError} として送出する。
 */
function buildArticleContent(
  group: ArticleGroup,
  parsed: ParsedArticleContent,
): { article: Article<IUnpersisted>; mdast: Root } {
  const slug = group.slug.toString();

  const publishedRaw = parsed.frontmatter.publishedOn;
  if (publishedRaw === undefined) {
    throw new ArticleContentError("frontmatter is missing publishedOn");
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
    const article = Article.create({
      slug: group.slug,
      title: ArticleTitle.create(parsed.frontmatter.title ?? group.base),
      summary: parsed.summary,
      imageUrl,
      publishedOn,
      lastModifiedOn,
      status: parsed.frontmatter.status,
      sourceHash: group.contentHash,
    });

    // 本文中の相対 URL をアセット API URL に解決してからキャッシュする (ADR 0005)。
    return { article, mdast: withAssetUrls(parsed.mdast, (url) => resolveAssetUrl(slug, url)) };
  } catch (error) {
    if (error instanceof ArticleContentError) throw error;
    // VO 検証・日付パース失敗はコンテンツ不正として扱う。
    throw new ArticleContentError(error instanceof Error ? error.message : String(error));
  }
}
