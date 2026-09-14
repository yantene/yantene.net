import { InvalidProfileNameError } from "./profile-name.vo";
import { InvalidSocialUrlError, UnknownSocialPlatformError } from "./social-account.vo";
import { InvalidTaglineError } from "./tagline.vo";
import { InvalidImageUrlError } from "~/backend/domain/shared";

/**
 * 保存されている値を VO に戻せないことを表すエラーの一覧。
 *
 * 同期の入口 (`parseProfileContent`) では、これらが出たらプロフィールごとスキップして
 * 前の姿を残す。**問題は出口のほう**で、D1 に既に入っている行が読めなくなる筋がある。
 * `app/lib/social-platforms.ts` から先を 1 つ落とせば、その先を持つ行は
 * `UnknownSocialPlatformError` になり、しかも同期は「読めないフロントマター」を
 * 弾いて旧行を残すので、コンテンツ側を直しても消えない。
 *
 * 出口でこれを投げっぱなしにすると、プロフィールを読むだけのトップと記事ページが
 * 巻き添えで落ちる。**読めない行は「無い」ものとして扱い、記事は落とさない**
 * (`handlers/profile/pages.handler.ts` の `loadProfile`)。黙って劣化させないために、
 * 倒すときは必ず `error` で記録に残す。
 *
 * ⚠️ **VO を足したらここにも足すこと。** 漏らすと、そのエラーだけが 500 として出る。
 */
const profileDataErrors = [
  InvalidImageUrlError,
  InvalidProfileNameError,
  InvalidSocialUrlError,
  InvalidTaglineError,
  UnknownSocialPlatformError,
] as const;

/** 保存されている行が読めないことによるエラーか (D1 そのものの障害と区別する)。 */
export function isProfileDataError(error: unknown): boolean {
  return profileDataErrors.some((type) => error instanceof type);
}
