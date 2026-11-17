import type { PublicSlide } from "./slide-view";
import type { LinkCardMap } from "~/backend/handlers/link-cards/link-card-view";
import type { Root } from "mdast";
import { resolveSlideReadAccess } from "./slide-read-access";
import { toPublicSlide } from "./slide-view";
import { shouldTellRobotsNoindex } from "~/backend/domain/shared";
import { slidePath, SlideSlug } from "~/backend/domain/slide";
import { shouldKeepResponsePrivate } from "~/backend/handlers/articles/article-read-access";
import {
  collectionPageJsonLd,
  personReference,
  websiteReference,
} from "~/backend/handlers/json-ld";
import { loadLinkCards } from "~/backend/handlers/link-cards/load-link-cards";
import { loadProfile } from "~/backend/handlers/profile/pages.handler";
import { D1SlideQueryRepository } from "~/backend/infra/d1/repositories";
import { R2SlideContentCache } from "~/backend/infra/r2/r2-slide-content-cache";
import { FALLBACK_PROFILE_NAME } from "~/lib/profile-fallback";

export interface SlidesPageData {
  /** 出した日の新しい順。まだ同期されていなければ空。 */
  readonly slides: readonly PublicSlide[];
  /** `/slides` の構造化データ (`CollectionPage`。ADR 0048)。スライドが無いあいだも出す。 */
  readonly jsonLd: Record<string, unknown>;
}

export interface SlideDetailPageData {
  /** 見つからなければ null。ページは 404 を描く。 */
  readonly slide: PublicSlide | null;
  /** 本文。スライドが無ければ null。 */
  readonly mdast: Root | null;
  /** 本文に貼られたむき出しの URL のカード。 */
  readonly linkCards: LinkCardMap;
  /** 表紙に出す書き手の名前 (プロフィールの displayName。同期前は FALLBACK_PROFILE_NAME)。 */
  readonly author: string;
  readonly jsonLd: Record<string, unknown> | null;
  /**
   * 検索エンジンに載せないよう伝えるか。`unlisted` のときだけ真 (記事のページと同じ欄。
   * ADR 0040)。隠す status は読み手に 404 を返すので、伝える相手がいない。
   */
  readonly noindex: boolean;
  /**
   * この応答を共有キャッシュから遠ざけるか。**真なら loader が `PRIVATE_CACHE_HEADERS` を
   * 付ける。** 管理者にしか見えない status を管理者に返したときだけ真になる。
   */
  readonly privateResponse: boolean;
}

/**
 * スライドの一覧を引く。`/slides` と sitemap が使う。
 *
 * **ログインしていても読み手向けで固定する** (`published` だけ。ADR 0040)。
 *
 * **切らずに全件返す。** 発表のたびに 1 本増えるもので、数十本に育つのは何年も先になる
 * (作品と同じ決め)。
 */
export async function loadSlides(env: Env): Promise<readonly PublicSlide[]> {
  const slides = await D1SlideQueryRepository.forReaders(env.D1).list();
  return slides.map((slide) => toPublicSlide(slide));
}

/** `/slides` のデータを揃える (Composition Root)。 */
export async function loadSlidesPage(env: Env, origin: string): Promise<SlidesPageData> {
  return {
    slides: await loadSlides(env),
    jsonLd: collectionPageJsonLd(origin, "/slides"),
  };
}

/**
 * `/slides/<slug>` のデータを揃える (Composition Root)。
 *
 * 管理者なら全 status を引く。読み手には `published` + `unlisted` だけ (ADR 0040)。
 *
 * - D1 にメタデータが無い (か、読み手に見せない status) → null (呼び出し側で 404)。
 * - D1 に在るのに R2 の MDAST が無い = キャッシュ不整合。静かに 404 で隠さず throw する
 *   (fail-loud)。出ているスライドが消えて見えるより、不整合を表面化させる。
 */
export async function loadSlideDetailPage(
  env: Env,
  request: Request,
  slugParam: string,
  origin: string,
): Promise<SlideDetailPageData> {
  const slug = SlideSlug.parse(slugParam);
  if (slug === undefined) return notFound();

  const access = await resolveSlideReadAccess(env, request);

  // 3 つは互いに独立なので並行に読む。プロフィールは、表紙の名前と JSON-LD の筆者に要る。
  const [slide, mdast, profile] = await Promise.all([
    access.query.findBySlug(slug),
    new R2SlideContentCache(env.R2).getMdast(slug),
    loadProfile(env),
  ]);

  if (slide === undefined) return notFound();
  if (mdast === undefined) {
    throw new Error(`MDAST cache is missing for an indexed slide: ${slug.toString()}`);
  }

  const publicSlide = toPublicSlide(slide);
  return {
    slide: publicSlide,
    mdast: mdast as Root,
    linkCards: await loadLinkCards(env, mdast as Root),
    // h-card・記事末尾・フィードと同じ 1 つの出どころ。同期前は既定の名前に倒れる。
    author: profile?.displayName ?? FALLBACK_PROFILE_NAME,
    jsonLd: slideJsonLd(publicSlide, personReference(origin, profile), origin),
    noindex: shouldTellRobotsNoindex(slide.status),
    privateResponse: shouldKeepResponsePrivate(access, slide.status),
  };
}

/**
 * スライドの JSON-LD。
 *
 * `description` は**語りがあるときだけ**出す。空の字を置くと「説明は空だと分かっている」
 * という主張になる。発表の場は載せない (当てはまる語彙が定まらない欄は足さない)。
 */
function slideJsonLd(
  slide: PublicSlide,
  author: Record<string, unknown>,
  origin: string,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "PresentationDigitalDocument",
    name: slide.title,
    ...(slide.summary.length === 0 ? {} : { description: slide.summary }),
    url: `${origin}${slidePath(slide.slug)}`,
    datePublished: slide.publishedOn,
    // 書き手は、記事の筆者や `/about` と同じ 1 人 (ADR 0048)。同じ `@id` で指す。
    author,
    isPartOf: websiteReference(origin),
  };
}

/**
 * 見つからなかったときの姿。
 *
 * 書き手の名前は既定のものを置く。404 のページは表紙を描かないので、そのためだけに
 * プロフィールを引かない (読めないスラグは D1 に触らずに返す)。
 */
function notFound(): SlideDetailPageData {
  return {
    slide: null,
    mdast: null,
    linkCards: {},
    author: FALLBACK_PROFILE_NAME,
    jsonLd: null,
    noindex: false,
    privateResponse: false,
  };
}
