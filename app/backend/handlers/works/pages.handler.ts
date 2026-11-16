import type { PublicWork } from "./work-view";
import type { Work } from "~/backend/domain/work";
import type { PublicArticle } from "~/backend/handlers/article-view";
import type { LinkCardMap } from "~/backend/handlers/link-cards/link-card-view";
import type { Root } from "mdast";
import { toPublicWork } from "./work-view";
import { articlePath } from "~/backend/domain/article";
import { workPath, WorkSlug } from "~/backend/domain/work";
import { toPublicArticle } from "~/backend/handlers/article-view";
import { loadLinkCards } from "~/backend/handlers/link-cards/load-link-cards";
import { loadProfile } from "~/backend/handlers/profile/pages.handler";
import {
  collectionPageJsonLd,
  personReference,
  websiteReference,
} from "~/backend/handlers/json-ld";
import { D1ArticleQueryRepository, D1WorkQueryRepository } from "~/backend/infra/d1/repositories";
import { R2WorkContentCache } from "~/backend/infra/r2/r2-work-content-cache";

export interface WorksPageData {
  /** 並び順 (`position` の小さい順)。まだ同期されていなければ空。 */
  readonly works: readonly PublicWork[];
  /** `/works` の構造化データ (`CollectionPage`。ADR 0048)。作品が無いあいだも出す。 */
  readonly jsonLd: Record<string, unknown>;
}

export interface WorkDetailPageData {
  /** 見つからなければ null。ページは 404 を描く。 */
  readonly work: PublicWork | null;
  /** 詳しい説明。作品が無ければ null。 */
  readonly mdast: Root | null;
  /** 説明に貼られたむき出しの URL のカード。 */
  readonly linkCards: LinkCardMap;
  /**
   * この作品について書いた記事。書き手が並べた順。
   *
   * **読み手に見える記事だけ。** 下書き・限定公開・取り下げ・まだ無い記事は黙って外れる。
   */
  readonly articles: readonly PublicArticle[];
  readonly jsonLd: Record<string, unknown> | null;
}

/**
 * 作品の一覧を引く。`/works` と `/about` が使う。
 *
 * **切らずに全件返す。** 作品は書き手が手で選んで置くもので、数十件に育つ前提が無い
 * (ADR 0042)。`/about` の側で「代表の N 件」に切らないのも同じ理由で、切るなら順位の
 * 定義が要るが、`position` が既にその役を果たしている。
 */
export async function loadWorks(env: Env): Promise<readonly PublicWork[]> {
  const works = await new D1WorkQueryRepository(env.D1).list();
  return works.map(toPublicWork);
}

/** `/works` のデータを揃える (Composition Root)。 */
export async function loadWorksPage(env: Env, origin: string): Promise<WorksPageData> {
  return {
    works: await loadWorks(env),
    jsonLd: collectionPageJsonLd(origin, "/works"),
  };
}

/**
 * `/works/<slug>` のデータを揃える (Composition Root)。
 *
 * - D1 にメタデータが無い = そもそも存在しない作品 → null (呼び出し側で 404)。
 * - D1 に在るのに R2 の MDAST が無い = キャッシュ不整合。静かに 404 で隠さず throw する
 *   (fail-loud)。公開済みの作品が消えて見えるより、不整合を表面化させる。
 */
export async function loadWorkDetailPage(
  env: Env,
  slugParam: string,
  origin: string,
): Promise<WorkDetailPageData> {
  const slug = WorkSlug.parse(slugParam);
  if (slug === undefined) return notFound();

  // 3 つは互いに独立なので並行に読む。プロフィールは、作った人を名指しするために要る。
  const [work, mdast, profile] = await Promise.all([
    new D1WorkQueryRepository(env.D1).findBySlug(slug),
    new R2WorkContentCache(env.R2).getMdast(slug),
    loadProfile(env),
  ]);

  if (work === undefined) return notFound();
  if (mdast === undefined) {
    throw new Error(`MDAST cache is missing for an indexed work: ${slug.toString()}`);
  }

  const publicWork = toPublicWork(work);
  const [linkCards, articles] = await Promise.all([
    loadLinkCards(env, mdast as Root),
    loadArticlesAbout(env, work),
  ]);
  return {
    work: publicWork,
    mdast: mdast as Root,
    linkCards,
    articles,
    jsonLd: workJsonLd(publicWork, articles, personReference(origin, profile), origin),
  };
}

/**
 * 作品について書いた記事を、読み手に見せてよいものだけ引く。
 *
 * **描画のたびに引き直す。** 同期のときに解決して覚えておくと、あとで記事を下書きに
 * 戻したときに作品のページから漏れる。
 *
 * ⚠️ **管理者でも `forReaders`。** ここは slug で 1 本引く経路ではなく記事を並べる
 * 経路なので、ログインしていても読み手と同じものを出す (ADR 0040)。引くのは
 * `findBySlugs` で、通すのは `published` だけ。**`findBySlug` を回さないこと**
 * (あちらは URL を直に打った読み手のための口で、限定公開の記事も通す)。
 *
 * 並びは書き手が決めた順に直す (`findBySlugs` は順を保証しない)。
 */
async function loadArticlesAbout(env: Env, work: Work): Promise<readonly PublicArticle[]> {
  const slugs = work.articleSlugs.map((slug) => slug.toString());
  if (slugs.length === 0) return [];

  const found = await D1ArticleQueryRepository.forReaders(env.D1).findBySlugs(slugs);
  const bySlug = new Map(found.map((article) => [article.slug.toString(), article]));
  return slugs.flatMap((slug) => {
    const article = bySlug.get(slug);
    return article === undefined ? [] : [toPublicArticle(article)];
  });
}

/**
 * 作品の JSON-LD。
 *
 * `image` と `subjectOf` は**在るときだけ**出す。空の配列を置くと「画像は無いと分かって
 * いる」という主張になる。`subjectOf` に載せるのは読み手に見える記事だけ (渡された
 * `articles` がそう絞られている)。
 */
function workJsonLd(
  work: PublicWork,
  articles: readonly PublicArticle[],
  creator: Record<string, unknown>,
  origin: string,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "CreativeWork",
    name: work.name,
    description: work.summary,
    url: `${origin}${workPath(work.slug)}`,
    // 外の在り処は「同じものを指す別の URL」。正規の URL はこちらなので url とは分ける。
    ...(work.url === null ? {} : { sameAs: [work.url] }),
    ...(work.screenshots.length === 0
      ? {}
      : { image: work.screenshots.map((screenshot) => `${origin}${screenshot.src}`) }),
    ...(articles.length === 0
      ? {}
      : {
          subjectOf: articles.map((article) => ({
            "@type": "BlogPosting",
            headline: article.title,
            url: `${origin}${articlePath(article.slug)}`,
          })),
        }),
    // 作った人は、記事の筆者や `/about` と同じ 1 人 (ADR 0048)。同じ `@id` で指す。
    creator,
    isPartOf: websiteReference(origin),
  };
}

function notFound(): WorkDetailPageData {
  return { work: null, mdast: null, linkCards: {}, articles: [], jsonLd: null };
}
