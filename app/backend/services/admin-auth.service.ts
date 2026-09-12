import type { Temporal } from "@js-temporal/polyfill";
import type {
  AdminCredential,
  AdminSession,
  AuthenticationResponse,
  IAdminCredentialCommandRepository,
  IAdminCredentialQueryRepository,
  IAdminSessionCommandRepository,
  IAdminSessionQueryRepository,
  IPasskeyCeremonyCommandRepository,
  IPasskeyVerifier,
  RegistrationResponse,
} from "~/backend/domain/admin";
import {
  AdminSessionId,
  AdminSession as Session,
  AdminCredential as Credential,
  CEREMONY_LIFETIME_SECONDS,
  CeremonyExpiredError,
  CeremonyMismatchError,
  Challenge,
  CredentialId,
  PasskeyVerificationError,
  RegistrationNotAllowedError,
  UnknownCredentialError,
} from "~/backend/domain/admin";

/**
 * 管理者の認証 (ADR 0036)。
 *
 * 儀式は 2 段階で進む。
 *
 * 1. `begin*` — チャレンジを発行して KV に預け、ブラウザに渡す選択肢を組み立てる
 * 2. `complete*` — 返ってきた応答を、預けたチャレンジと突き合わせて検証する
 *
 * **チャレンジは検証の成否によらず捨てる。** 残すと同じチャレンジで何度も試せる。
 */

/** 儀式の制限時間 (ミリ秒)。ブラウザに渡す目安で、期限そのものは KV が持つ。 */
const CEREMONY_TIMEOUT_MS = CEREMONY_LIFETIME_SECONDS * 1000;

/**
 * 利用者を指す識別子。
 *
 * 管理者は 1 人なので定数でよい。WebAuthn はこれを「同じ利用者の鍵をまとめる印」として
 * 使うので、**同じ端末で登録し直すとその端末の鍵が置き換わる** (別の端末の鍵はそのまま)。
 * 個人を示す値を入れてはならないと定められているため、意味を持たない固定値にしてある。
 */
const USER_HANDLE = "eWFudGVuZS1hZG1pbg";

/** 画面に出る名前。認証器の鍵の一覧に表示される。 */
const USER_NAME = "yantene";

/** 申告する算法。ES256 と RS256 だけ (ADR 0036)。 */
const PUB_KEY_CRED_PARAMS = [
  { type: "public-key", alg: -7 },
  { type: "public-key", alg: -257 },
] as const;

/** 儀式が行われる場所。要求の URL から導く (下記 `originOf`)。 */
export interface CeremonySite {
  readonly origin: string;
  readonly rpId: string;
}

/** ブラウザの `navigator.credentials.create()` に渡す選択肢 (JSON 表現)。 */
export interface RegistrationOptions {
  readonly challenge: string;
  readonly rp: { readonly id: string; readonly name: string };
  readonly user: { readonly id: string; readonly name: string; readonly displayName: string };
  readonly pubKeyCredParams: readonly { readonly type: string; readonly alg: number }[];
  readonly authenticatorSelection: {
    readonly residentKey: string;
    readonly requireResidentKey: boolean;
    readonly userVerification: string;
  };
  readonly excludeCredentials: readonly { readonly type: string; readonly id: string }[];
  readonly attestation: string;
  readonly timeout: number;
}

/** ブラウザの `navigator.credentials.get()` に渡す選択肢 (JSON 表現)。 */
export interface AuthenticationOptions {
  readonly challenge: string;
  readonly rpId: string;
  readonly userVerification: string;
  readonly timeout: number;
}

export interface AdminAuthDependencies {
  readonly credentialQuery: IAdminCredentialQueryRepository;
  readonly credentialCommand: IAdminCredentialCommandRepository;
  readonly sessionQuery: IAdminSessionQueryRepository;
  readonly sessionCommand: IAdminSessionCommandRepository;
  readonly ceremonyCommand: IPasskeyCeremonyCommandRepository;
  readonly verifier: IPasskeyVerifier;
}

export class AdminAuthService {
  constructor(private readonly deps: AdminAuthDependencies) {}

  /* ------------------------------------------------------------ 登録 */

  /**
   * 登録の儀式を始める。
   *
   * すでに登録済みの credential は `excludeCredentials` で除く。同じ認証器を 2 度
   * 登録すると、古い行が使われないまま残る。
   */
  async beginRegistration(site: CeremonySite): Promise<RegistrationOptions> {
    const challenge = Challenge.issue();
    await this.deps.ceremonyCommand.issue({ challenge, purpose: "registration" });

    const registered = await this.deps.credentialQuery.list();
    return {
      challenge: challenge.toString(),
      rp: { id: site.rpId, name: site.rpId },
      user: { id: USER_HANDLE, name: USER_NAME, displayName: USER_NAME },
      pubKeyCredParams: PUB_KEY_CRED_PARAMS,
      authenticatorSelection: {
        // 端末の中から鍵を選べるようにする (discoverable)。こうしないと、ログインの
        // ときに「どの鍵を使うか」を先に知らせる必要が生じ、登録済みの鍵の一覧を
        // 誰にでも配ることになる。
        residentKey: "required",
        requireResidentKey: true,
        // 生体か PIN で持ち主を確かめさせる。検証側も UV を必須にしてある。
        userVerification: "required",
      },
      excludeCredentials: registered.map((credential) => ({
        type: "public-key",
        id: credential.id.toString(),
      })),
      // アテステーションは見ない (ADR 0036)。求めないので送られてこない。
      attestation: "none",
      timeout: CEREMONY_TIMEOUT_MS,
    };
  }

  /** 登録の応答を検証して保存する。落ちたら送出する。 */
  async completeRegistration(params: {
    response: RegistrationResponse;
    site: CeremonySite;
    label: string;
    at: Temporal.Instant;
  }): Promise<AdminCredential> {
    const challenge = await this.takeChallenge(params.response.clientDataJSON, "registration");

    const verified = await this.deps.verifier.verifyRegistration(params.response, {
      ...params.site,
      challenge: challenge.toString(),
    });

    const credential = Credential.register({
      id: verified.credentialId,
      publicKey: verified.publicKey,
      algorithm: verified.algorithm,
      signCount: verified.signCount,
      label: params.label,
      backedUp: verified.backedUp,
      at: params.at,
    });
    await this.deps.credentialCommand.add(credential);
    return credential;
  }

  /* ------------------------------------------------------------ 認証 */

  async beginAuthentication(site: CeremonySite): Promise<AuthenticationOptions> {
    const challenge = Challenge.issue();
    await this.deps.ceremonyCommand.issue({ challenge, purpose: "authentication" });

    return {
      challenge: challenge.toString(),
      rpId: site.rpId,
      userVerification: "required",
      timeout: CEREMONY_TIMEOUT_MS,
      // allowCredentials は出さない。登録済みの credential id を、ログインしていない
      // 相手に配ることになるため。discoverable な鍵なのでブラウザ側で選べる。
    };
  }

  /** 認証の応答を検証し、セッションを起こす。落ちたら送出する。 */
  async completeAuthentication(params: {
    response: AuthenticationResponse;
    site: CeremonySite;
    at: Temporal.Instant;
  }): Promise<AdminSession> {
    const challenge = await this.takeChallenge(params.response.clientDataJSON, "authentication");

    const credential = await this.deps.credentialQuery.findById(
      parseCredentialId(params.response.id),
    );
    if (credential === undefined) {
      throw new UnknownCredentialError("no such credential is registered");
    }

    const verified = await this.deps.verifier.verifyAuthentication(params.response, credential, {
      ...params.site,
      challenge: challenge.toString(),
    });

    // 使用回数と最終使用時刻を書き戻す。**後退していても拒否しない。**
    // 同期される鍵は複数の端末に居るので、回数は進まないのが普通 (ADR 0036)。
    await this.deps.credentialCommand.save(credential.withUse(verified.signCount, params.at));

    const session = Session.start({
      id: AdminSessionId.issue(),
      credentialId: credential.id,
      at: params.at,
    });
    await this.deps.sessionCommand.save(session);
    return session;
  }

  /* ---------------------------------------------------------- セッション */

  /**
   * セッションを引き、生きていれば期限を引き直して返す。
   *
   * 引き直しは KV への書き込みになるので、**同じ秒のうちに何度も呼ばれても書かない**
   * ようにはしていない。管理画面の要求は多くないので、素直に毎回延ばす。
   */
  async touchSession(id: AdminSessionId, at: Temporal.Instant): Promise<AdminSession | undefined> {
    const session = await this.deps.sessionQuery.findById(id);
    if (session === undefined) return undefined;

    /*
     * **入るのに使った鍵がまだ在ることを、要求のたびに確かめる。**
     *
     * 鍵を取り消す目的は「その端末から入れなくする」ことなので、すでに開いている
     * セッションが生き延びては意味が無い。しかもこのセッションは触るたびに期限が
     * 延びるので、使い続けられている限り永遠に切れない。取り消しがいちばん要るのは
     * 端末を失ったときで、そのときまさに相手は使い続けている。
     *
     * 管理者の要求は多くないので、1 回の読み足しは払ってよい。
     */
    const credential = await this.deps.credentialQuery.findById(session.credentialId);
    if (credential === undefined) {
      await this.deps.sessionCommand.remove(session.id);
      return undefined;
    }

    const touched = session.withSeen(at);
    await this.deps.sessionCommand.save(touched);
    return touched;
  }

  async logout(id: AdminSessionId): Promise<void> {
    await this.deps.sessionCommand.remove(id);
  }

  /* ------------------------------------------------------ 登録の入口を守る */

  /**
   * いまこの要求が登録を許されているかを確かめる。許されなければ送出する。
   *
   * - 資格情報が 1 本も無い → 登録用の secret を示した要求だけ通す (bootstrap)
   * - 1 本でもある → ログイン済みの要求だけ通す
   *
   * 端末をすべて失うと、どちらも満たせなくなる。そのときは D1 の表を空にして
   * bootstrap からやり直す (ADR 0036)。
   */
  async assertRegistrationAllowed(params: {
    presentedToken: string | undefined;
    /**
     * 登録用の secret を読む。**bootstrap の枝に入ったときだけ呼ぶ。**
     *
     * 無ければ送出する関数を渡してよい。先に呼ばないのは、secret を消したあとの
     * 環境でサインイン中の追加登録まで閉じてしまうため。**復旧用の端末を足す手段が
     * secret の有無に縛られてはいけない。**
     */
    readRegistrationToken: () => string;
    session: AdminSession | undefined;
  }): Promise<void> {
    if (params.session !== undefined) return;

    const registered = await this.deps.credentialQuery.count();
    if (registered > 0) {
      throw new RegistrationNotAllowedError("sign in before registering another passkey");
    }
    if (
      params.presentedToken === undefined ||
      !(await equalsSecret(params.presentedToken, params.readRegistrationToken()))
    ) {
      throw new RegistrationNotAllowedError("the registration token does not match");
    }
  }

  /* ------------------------------------------------------------ 内部 */

  /**
   * 応答に入っているチャレンジを取り出し、預けたものと引き当てて消す。
   *
   * clientDataJSON はまだ検証していない値だが、ここで使うのは**保存先の鍵として
   * だけ**。形を `Challenge` で確かめてから引くので、任意の文字列で KV を探ることは
   * できない。中身の検証は引き当てたあとに verifier が行う。
   */
  private async takeChallenge(
    clientDataJSON: string,
    purpose: "registration" | "authentication",
  ): Promise<Challenge> {
    const challenge = readChallenge(clientDataJSON);

    // **取り出しと削除は 1 手。** 読んでから消す形だと、同じ応答を同時に 2 回
    // 送られたときに両方が通る。
    const ceremony = await this.deps.ceremonyCommand.consume(challenge);

    if (ceremony === undefined) {
      throw new CeremonyExpiredError("this challenge was never issued, or has already been used");
    }
    // 種類が違っても消えたままにする。戻すと、同じチャレンジで何度も試せる。
    if (ceremony.purpose !== purpose) {
      throw new CeremonyMismatchError(`this challenge was issued for ${ceremony.purpose}`);
    }
    return challenge;
  }
}

/**
 * 要求の URL から儀式の場所を導く。
 *
 * `Host` は要求ごとに変わるが、それで困ることはない。攻撃者が別のホスト名で叩いても、
 * 得られるのは「そのホスト名のための選択肢」だけ。被害者のブラウザは**自分が開いて
 * いる生成元**の鍵しか使わせないので、他所のための応答を作らせることはできない。
 *
 * 導く形にしてあるのは、手元 (localhost)・staging・PR ごとのプレビュー URL が
 * 設定を足さずに動くようにするため。
 */
export function ceremonySiteOf(url: URL): CeremonySite {
  return { origin: url.origin, rpId: url.hostname };
}

/** 応答の clientDataJSON からチャレンジを読む。形が違えば期限切れと同じ扱いにする。 */
function readChallenge(clientDataJSON: string): Challenge {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeBase64UrlText(clientDataJSON));
  } catch {
    throw new PasskeyVerificationError("clientDataJSON is not readable");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new PasskeyVerificationError("clientDataJSON is not an object");
  }
  const { challenge } = parsed as Record<string, unknown>;
  if (typeof challenge !== "string") {
    throw new PasskeyVerificationError("clientDataJSON has no challenge");
  }
  try {
    return Challenge.create(challenge);
  } catch {
    throw new CeremonyExpiredError("this challenge was never issued");
  }
}

function decodeBase64UrlText(value: string): string {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  return new TextDecoder().decode(
    Uint8Array.from(
      atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")),
      (character) => character.codePointAt(0) ?? 0,
    ),
  );
}

function parseCredentialId(raw: string): CredentialId {
  try {
    return CredentialId.create(raw);
  } catch {
    throw new UnknownCredentialError("the response names an unreadable credential id");
  }
}

/**
 * secret を、長さも中身も漏らさずに突き合わせる。
 *
 * 素の `===` は最初に違うバイトで打ち切るので、返るまでの時間が中身に応じて変わる。
 * 遠くから測って当てるのは現実には難しいが、避けるのは安い。両方をハッシュしてから
 * 比べれば、長さも揃い、比較そのものも固定の手数で済む。
 */
async function equalsSecret(presented: string, expected: string): Promise<boolean> {
  const [left, right] = await Promise.all([digest(presented), digest(expected)]);
  return left.reduce((diff, byte, index) => diff | (byte ^ right[index]), 0) === 0;
}

async function digest(value: string): Promise<Uint8Array> {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}
