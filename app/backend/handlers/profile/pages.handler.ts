import type { PublicHistoryChapter, PublicProfile } from "./profile-view";
import type { LinkCardMap } from "~/backend/handlers/link-cards/link-card-view";
import type { PublicWork } from "~/backend/handlers/works/work-view";
import type { HistoryEntry } from "~/backend/domain/profile";
import type { Root } from "mdast";
import { profilePageJsonLd } from "~/backend/handlers/json-ld";
import { toPublicHistory, toPublicProfile } from "./profile-view";
import { loadLinkCards } from "~/backend/handlers/link-cards/load-link-cards";
import { loadWorks } from "~/backend/handlers/works/pages.handler";
import { isProfileDataError } from "~/backend/domain/profile";
import { errorToContext } from "~/backend/domain/shared";
import { ConsoleLogger } from "~/backend/infra/console/console-logger";
import { D1ProfileQueryRepository } from "~/backend/infra/d1/repositories";
import { R2ProfileContentCache } from "~/backend/infra/r2/r2-profile-content-cache";

export interface AboutPageData {
  /** まだ同期されていなければ null。ページは「準備中」に倒れる。 */
  readonly profile: PublicProfile | null;
  /** 長い自己紹介。プロフィールが無ければ null。 */
  readonly mdast: Root | null;
  /**
   * 経歴。章ごとに畳んである。書いていなければ空 (節ごと出さない)。
   *
   * **出るのはここだけ。** トップと記事の末尾は読まないので `PublicProfile` には
   * 載せていない (ADR 0044)。
   */
  readonly history: readonly PublicHistoryChapter[];
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
  /** `/about` の構造化データ (`ProfilePage`)。同期の前も出す (書き手は殻だけ)。 */
  readonly jsonLd: Record<string, unknown>;
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
  const profile = await degradeOnUnreadableRows(
    () => new D1ProfileQueryRepository(env.D1).find(),
    undefined,
    "stored profile could not be read; falling back to the default h-card",
  );
  return profile === undefined ? null : toPublicProfile(profile);
}

/**
 * 保存されている行が読めないときに、そこだけ「無い」ことにして読み進める。
 *
 * D1 に入っている行が VO に戻せなくなる筋がある。たとえば `social-platforms.ts` から
 * 先を 1 つ落とすと、その先を持つ既存の行は読めない。**投げっぱなしにするとページごと
 * 500 になり、しかも同期は読めないフロントマターを弾いて旧行を残すので、コンテンツ側を
 * 直しても復旧しない。**
 *
 * 黙って劣化させないために、倒すときは必ず `error` で記録に残す。**D1 そのものの障害は
 * throw し直す** (握りつぶさない)。
 */
async function degradeOnUnreadableRows<T>(
  read: () => Promise<T>,
  fallback: T,
  message: string,
): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (!isProfileDataError(error)) throw error;
    new ConsoleLogger({ component: "profile" }).error(message, errorToContext(error));
    return fallback;
  }
}

/**
 * `/about` のデータを揃える (Composition Root)。
 *
 * プロフィールが無いときは 404 にせず null を返す。ヘッダーのナビが常に指している
 * 行き先なので、初回同期の前に「そんなページは無い」と答えるのは嘘になる。
 *
 * **保存されている行が読めないときも落とさない。** 読む口を 2 つに分けてあるので、
 * 倒れ方も分かれる — プロフィールが読めなければページごと「準備中」に、経歴だけが
 * 読めなければその節だけを落とす。以前はどちらも root の ErrorBoundary に落ちていて、
 * トップと記事ページが既定の h-card に倒れるのに `/about` だけ 500 になっていた (#519)。
 */
export async function loadAboutPage(env: Env, origin: string): Promise<AboutPageData> {
  const query = new D1ProfileQueryRepository(env.D1);
  const [profile, history, mdast, works] = await Promise.all([
    degradeOnUnreadableRows(
      () => query.find(),
      undefined,
      "stored profile could not be read; falling back to the coming-soon page",
    ),
    /*
     * ⚠️ **経歴が読めなくても、ページの残りは出す。** 読む口を分けてあるので、ここで
     * 倒れても名前・自己紹介・作ったものは出せる。節が 1 つ消えるだけで済むものを、
     * ページごと落とす理由が無い。
     */
    degradeOnUnreadableRows(
      () => query.findHistory(),
      [] as readonly HistoryEntry[],
      "stored history could not be read; dropping the history section",
    ),
    new R2ProfileContentCache(env.R2).getMdast(),
    loadWorks(env),
  ]);

  if (profile === undefined) {
    return {
      profile: null,
      mdast: null,
      history: [],
      linkCards: {},
      works: [],
      jsonLd: profilePageJsonLd(origin, null),
    };
  }
  if (mdast === undefined) {
    // D1 に行があるのに本文が無いのは同期の壊れ方。黙って空のページを出さない。
    throw new Error("profile is indexed in D1 but its body is missing from R2");
  }

  const publicProfile = toPublicProfile(profile);
  return {
    profile: publicProfile,
    mdast: mdast as Root,
    history: toPublicHistory(history),
    linkCards: await loadLinkCards(env, mdast as Root),
    works,
    /*
     * `ProfilePage` で包み、主題に書き手を置く (ADR 0048)。
     */
    jsonLd: profilePageJsonLd(origin, publicProfile),
  };
}
