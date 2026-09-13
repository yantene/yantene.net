import type { Temporal } from "@js-temporal/polyfill";
import type {
  AuthSession,
  AuthSessionId,
  EmailAddress,
  IAuthSessionCommandRepository,
  IAuthSessionQueryRepository,
  IMailer,
  ISignInTokenCommandRepository,
  ISignInTokenQueryRepository,
  SignInRequestId,
} from "~/backend/domain/auth";
import type { ILogger } from "~/backend/domain/shared";
import type { SupportedLocale } from "~/lib/i18n/locale";
import {
  AuthSession as AuthSessionEntity,
  AuthSessionId as AuthSessionIdVo,
  SignInToken,
} from "~/backend/domain/auth";
import { errorToContext } from "~/backend/domain/shared";
import { buildSignInMail } from "./sign-in-mail";

/**
 * 1 つのアドレス宛に同時に生かしておけるリンクの本数。
 *
 * **受信箱を埋めさせないための上限。** 届かないときの送り直しは効いてほしいので
 * 1 本には絞らない。窓はリンクの寿命 (15 分) と同じで、切れた行は数に入らない。
 */
export const MAX_LIVE_LINKS_PER_ADDRESS = 3;

export interface SignInServiceDependencies {
  readonly tokenCommand: ISignInTokenCommandRepository;
  readonly tokenQuery: ISignInTokenQueryRepository;
  readonly sessionCommand: IAuthSessionCommandRepository;
  readonly sessionQuery: IAuthSessionQueryRepository;
  readonly mailer: IMailer;
  readonly logger: ILogger;
  /**
   * リンクを送ってよいアドレス。
   *
   * **いまは `ADMIN_EMAIL` の 1 つ** (ADR 0039)。空なら誰にも送らない
   * (secure by default)。
   */
  readonly allowedEmails: readonly EmailAddress[];
}

export interface RequestSignInLinkParams {
  readonly email: EmailAddress;
  readonly requestId: SignInRequestId;
  /** トークンを踏ませる URL を組み立てる。HTTP の都合なので呼ぶ側が持つ。 */
  readonly buildUrl: (token: SignInToken) => string;
  readonly locale: SupportedLocale;
  readonly at: Temporal.Instant;
}

/**
 * マジックリンクでのログイン (ADR 0039)。
 *
 * 外から見える結果を、アドレスが許されているかどうかで**変えない**のがこの層の役目。
 * 送る・送らないの判断はすべてここで畳み、呼ぶ側には何も返さない。
 */
export class SignInService {
  constructor(private readonly deps: SignInServiceDependencies) {}

  /**
   * リンクを送る。送れなかったことは呼ぶ側に返さない。
   *
   * **応答の前に待たせない**呼び方 (`ctx.waitUntil`) を想定している。だから中で
   * 落ちても外へは伝わらない — 気づく手立てが記録しかないので、必ず残す。
   */
  async requestLink(params: RequestSignInLinkParams): Promise<void> {
    const logger = this.deps.logger.child({ at: "SignInService.requestLink" });

    if (!this.isAllowed(params.email)) {
      // アドレスは出さない。記録から「誰が叩いたか」の一覧を作らせない。
      logger.info("sign-in requested for an address that cannot sign in");
      return;
    }

    const live = await this.deps.tokenQuery.countLiveFor(params.email, params.at);
    if (live >= MAX_LIVE_LINKS_PER_ADDRESS) {
      logger.warn("sign-in link was not sent: too many live links", { live });
      return;
    }

    const token = SignInToken.issue();
    await this.deps.tokenCommand.issue({
      token,
      email: params.email,
      requestId: params.requestId,
      issuedAt: params.at,
    });

    try {
      await this.deps.mailer.send(
        buildSignInMail({ to: params.email, url: params.buildUrl(token), locale: params.locale }),
      );
    } catch (error) {
      /*
       * 送れなかったトークンは残しておく。**消す実益が無い**ばかりか、消すと
       * 「配信は落ちたが実は届いていた」ときに、届いたリンクだけが死ぬ。
       * 15 分で勝手に切れるので放っておいてよい。
       */
      logger.error("failed to send the sign-in mail", errorToContext(error));
    }
  }

  /**
   * 踏まれたリンクを使い切ってセッションを配る。使えなければ undefined。
   *
   * `requestId` を渡すのは `GET` の近道のとき。**一致しなければ何も消費しない**ので、
   * 確認の画面からやり直せる (ADR 0039)。
   */
  async completeSignIn(params: {
    readonly token: SignInToken;
    readonly at: Temporal.Instant;
    readonly requestId?: SignInRequestId;
  }): Promise<AuthSession | undefined> {
    const email = await this.deps.tokenCommand.consume(params.token, params.at, {
      requestId: params.requestId,
    });
    if (email === undefined) return undefined;

    /*
     * 使い切った時点でもう一度引き比べる。リンクを送ってから踏まれるまでの 15 分で
     * 許可を外されていることがある。
     */
    if (!this.isAllowed(email)) return undefined;

    const session = AuthSessionEntity.start({ id: AuthSessionIdVo.issue(), email, at: params.at });
    await this.deps.sessionCommand.save(session);
    return session;
  }

  /**
   * セッションが生きているかを見て、期限を引き直す。
   *
   * 書き戻すのは間が空いたときだけ。毎回書くと、同じ鍵への連続した書き込みで弾かれる
   * ことがある (AuthSession.needsRenewal)。
   */
  async touchSession(id: AuthSessionId, at: Temporal.Instant): Promise<AuthSession | undefined> {
    const session = await this.deps.sessionQuery.findById(id);
    if (session === undefined) return undefined;

    if (!session.needsRenewal(at)) return session;

    const seen = session.withSeen(at);
    await this.deps.sessionCommand.save(seen);
    return seen;
  }

  async signOut(id: AuthSessionId): Promise<void> {
    await this.deps.sessionCommand.remove(id);
  }

  private isAllowed(email: EmailAddress): boolean {
    return this.deps.allowedEmails.some((allowed) => allowed.equals(email));
  }
}
