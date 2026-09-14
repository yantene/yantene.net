import { toPublicProfile, type PublicProfile } from "./profile-view";
import type { Root } from "mdast";
import { D1ProfileQueryRepository } from "~/backend/infra/d1/repositories";
import { R2ProfileContentCache } from "~/backend/infra/r2/r2-profile-content-cache";

/** 名乗りに出す顔。近影ではなくやんてねくんのアイコン (#413 の続きで差し替える)。 */
const AVATAR_PATH = "/icons/icon-192.png";

export interface AboutPageData {
  /**
   * プロフィール。**まだ同期していなければ null。**
   *
   * 初回の refresh の前と、`profile.md` を消した直後がこれに当たる。ページは落とさず
   * 「準備中」に倒す (ナビから来た読み手に 500 を見せない)。
   */
  readonly profile: PublicProfile | null;
  /** 本文 (経歴と好きなもの) の MDAST。プロフィールが無ければ null。 */
  readonly mdast: Root | null;
  /** `Person` の構造化データ。プロフィールが無ければ undefined (出す中身が無い)。 */
  readonly jsonLd: Record<string, unknown> | undefined;
}

/**
 * `/about` のデータを読む (Composition Root)。
 *
 * D1 の 1 行と R2 の MDAST を並べて取る。**片方だけで描かない。**
 * 行があるのに本文が無いのは同期が途中で落ちた姿なので、揃っていなければ
 * 「準備中」に倒す (ADR 0041)。
 */
export async function loadAboutPage(env: Env, origin: string): Promise<AboutPageData> {
  const [found, mdast] = await Promise.all([
    new D1ProfileQueryRepository(env.D1).find(),
    new R2ProfileContentCache(env.R2).getMdast(),
  ]);

  if (found === undefined || mdast === undefined) {
    return { profile: null, mdast: null, jsonLd: undefined };
  }

  const profile = toPublicProfile(found);
  // R2 に置いたのは refresh が組んだ MDAST なので、形は分かっている (記事と同じ扱い)。
  return { profile, mdast: mdast as Root, jsonLd: toPersonJsonLd(profile, origin) };
}

/**
 * `Person` の構造化データ。
 *
 * `sameAs` に並べるのは**自分のものだと主張できる先だけ**にする。`rel="me"` と同じ
 * 判定にしておかないと、画面では主張していない先を機械にだけ主張することになる。
 */
function toPersonJsonLd(profile: PublicProfile, origin: string): Record<string, unknown> {
  const sameAs = profile.socials.filter((link) => link.isMe).map((link) => link.url);

  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: profile.name,
    description: profile.tagline.replaceAll("\n", " "),
    birthDate: profile.dateOfBirth,
    ...(profile.birthplace === null ? {} : { birthPlace: profile.birthplace }),
    image: `${origin}${AVATAR_PATH}`,
    url: `${origin}/about`,
    ...(sameAs.length === 0 ? {} : { sameAs }),
  };
}
