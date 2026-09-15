import type { PublicProfile } from "./profile-view";
import type { LinkCardMap } from "~/backend/handlers/link-cards/link-card-view";
import type { PublicWork } from "~/backend/handlers/works/work-view";
import type { Root } from "mdast";
import { toPublicProfile } from "./profile-view";
import { loadLinkCards } from "~/backend/handlers/link-cards/load-link-cards";
import { loadWorks } from "~/backend/handlers/works/pages.handler";
import { isProfileDataError } from "~/backend/domain/profile";
import { errorToContext } from "~/backend/domain/shared";
import { ConsoleLogger } from "~/backend/infra/console/console-logger";
import { D1ProfileQueryRepository } from "~/backend/infra/d1/repositories";
import { R2ProfileContentCache } from "~/backend/infra/r2/r2-profile-content-cache";
import { PROFILE_PHOTO } from "~/lib/profile-fallback";

export interface AboutPageData {
  /** まだ同期されていなければ null。ページは「準備中」に倒れる。 */
  readonly profile: PublicProfile | null;
  /** 長い自己紹介。プロフィールが無ければ null。 */
  readonly mdast: Root | null;
  /** 長い自己紹介に貼られたむき出しの URL のカード。 */
  readonly linkCards: LinkCardMap;
  /**
   * 作ったもの。本文ではなくフロントマターの概要を並べる。
   *
   * **プロフィールが無ければ空。** ページごと「準備中」の一枚に倒れるので、ここだけ
   * 中身を返しても出る場所が無い。`noindex` を立てたページに中身がある、という
   * ちぐはぐも作らない。作品そのものは `/works` が独立に出す。
   */
  readonly works: readonly PublicWork[];
  readonly jsonLd: Record<string, unknown> | null;
}

/**
 * 短いプロフィールだけを引く。トップのヒーローと記事の末尾が使う。
 *
 * まだ同期されていなければ null。呼ぶ側は落とさずに描くこと (プロフィールが無いことは
 * 記事が読めない理由にならない)。
 *
 * **保存されている行が読めないときも null に倒す。** たとえば `social-platforms.ts` から
 * 先を 1 つ落とすと、その先を持つ既存の行は VO に戻せなくなる。投げっぱなしにすると
 * トップと全記事ページが 500 になり、しかも同期は読めないフロントマターを弾いて旧行を
 * 残すので、コンテンツ側を直しても復旧しない。読み手には既定の h-card を見せ、
 * 起きたことは `error` で記録に残す。D1 そのものの障害は throw し直す (握りつぶさない)。
 */
export async function loadProfile(env: Env): Promise<PublicProfile | null> {
  try {
    const profile = await new D1ProfileQueryRepository(env.D1).find();
    return profile === undefined ? null : toPublicProfile(profile);
  } catch (error) {
    if (!isProfileDataError(error)) throw error;
    new ConsoleLogger({ component: "profile" }).error(
      "stored profile could not be read; falling back to the default h-card",
      errorToContext(error),
    );
    return null;
  }
}

/**
 * `/about` のデータを揃える (Composition Root)。
 *
 * プロフィールが無いときは 404 にせず null を返す。ヘッダーのナビが常に指している
 * 行き先なので、初回同期の前に「そんなページは無い」と答えるのは嘘になる。
 */
export async function loadAboutPage(env: Env, origin: string): Promise<AboutPageData> {
  const [profile, mdast, works] = await Promise.all([
    new D1ProfileQueryRepository(env.D1).find(),
    new R2ProfileContentCache(env.R2).getMdast(),
    loadWorks(env),
  ]);

  if (profile === undefined) {
    return { profile: null, mdast: null, linkCards: {}, works: [], jsonLd: null };
  }
  if (mdast === undefined) {
    // D1 に行があるのに本文が無いのは同期の壊れ方。黙って空のページを出さない。
    throw new Error("profile is indexed in D1 but its body is missing from R2");
  }

  const publicProfile = toPublicProfile(profile);
  return {
    profile: publicProfile,
    mdast: mdast as Root,
    linkCards: await loadLinkCards(env, mdast as Root),
    works,
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Person",
      name: publicProfile.name,
      description: publicProfile.tagline.join(" "),
      url: `${origin}/about`,
      image: `${origin}${PROFILE_PHOTO}`,
      // 自分のものだと主張できる先だけを並べる。相互リンクの無い先を挙げると、
      // 確かめた側から見て嘘になる (h-card の rel="me" と同じ線引き)。
      sameAs: publicProfile.socials.filter((social) => social.isMe).map((social) => social.url),
    },
  };
}
