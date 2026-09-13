import type { PublicLifeEvent, PublicProfile } from "./profile-view";
import type { LinkCardMap } from "~/backend/handlers/link-cards/link-card-view";
import type { Root } from "mdast";
import { toPublicLifeEvents, toPublicProfile } from "./profile-view";
import { loadLinkCards } from "~/backend/handlers/link-cards/load-link-cards";
import { D1ProfileQueryRepository } from "~/backend/infra/d1/repositories";
import { R2ProfileContentCache } from "~/backend/infra/r2/r2-profile-content-cache";

export interface AboutPageData {
  /** まだ同期されていなければ null。ページは「準備中」に倒れる。 */
  readonly profile: PublicProfile | null;
  readonly lifeEvents: readonly PublicLifeEvent[];
  /** 長い自己紹介。プロフィールが無ければ null。 */
  readonly mdast: Root | null;
  /** 長い自己紹介に貼られたむき出しの URL のカード。 */
  readonly linkCards: LinkCardMap;
  readonly jsonLd: Record<string, unknown> | null;
}

/**
 * 短いプロフィールだけを引く。トップのヒーローと記事の末尾が使う。
 *
 * まだ同期されていなければ null。呼ぶ側は落とさずに描くこと (プロフィールが無いことは
 * 記事が読めない理由にならない)。
 */
export async function loadProfile(env: Env): Promise<PublicProfile | null> {
  const profile = await new D1ProfileQueryRepository(env.D1).find();
  return profile === undefined ? null : toPublicProfile(profile);
}

/**
 * `/about` のデータを揃える (Composition Root)。
 *
 * プロフィールが無いときは 404 にせず null を返す。ヘッダーのナビが常に指している
 * 行き先なので、初回同期の前に「そんなページは無い」と答えるのは嘘になる。
 */
export async function loadAboutPage(env: Env, origin: string): Promise<AboutPageData> {
  const [profile, mdast] = await Promise.all([
    new D1ProfileQueryRepository(env.D1).find(),
    new R2ProfileContentCache(env.R2).getMdast(),
  ]);

  if (profile === undefined) {
    return { profile: null, lifeEvents: [], mdast: null, linkCards: {}, jsonLd: null };
  }
  if (mdast === undefined) {
    // D1 に行があるのに本文が無いのは同期の壊れ方。黙って空のページを出さない。
    throw new Error("profile is indexed in D1 but its body is missing from R2");
  }

  const publicProfile = toPublicProfile(profile);
  return {
    profile: publicProfile,
    lifeEvents: toPublicLifeEvents(profile),
    mdast: mdast as Root,
    linkCards: await loadLinkCards(env, mdast as Root),
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "Person",
      name: publicProfile.name,
      description: publicProfile.tagline.join(" "),
      url: `${origin}/about`,
      ...(publicProfile.avatarUrl === null ? {} : { image: `${origin}${publicProfile.avatarUrl}` }),
      // 自分のものだと主張できる先だけを並べる。相互リンクの無い先を挙げると、
      // 確かめた側から見て嘘になる (h-card の rel="me" と同じ線引き)。
      sameAs: publicProfile.socials.filter((social) => social.isMe).map((social) => social.url),
    },
  };
}
