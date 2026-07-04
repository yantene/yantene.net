import type { IMailer } from "~/backend/domain/auth";
import type { IMagicLinkTokenStore } from "~/backend/domain/auth/magic-link";
import type { ISessionStore } from "~/backend/domain/shared";
import type {
  IUserCommandRepository,
  IUserQueryRepository,
} from "~/backend/domain/user";
import { DuplicateEmailError, Email, User } from "~/backend/domain/user";

/**
 * 認証ユースケースのアプリケーションサービス。
 *
 * トランスポート (HTTP / cookie / redirect) には依存せず、domain のインターフェースだけに依存する。
 * 具象の生成と注入は Composition Root (handlers/) の責務。
 *
 * `signInWithVerifiedEmail` は「本人確認済みの email からセッションを確立する」共通の合流点で、
 * magic link も将来の OIDC など他の認証方式もすべてここに合流する。
 */
export class AuthService {
  constructor(
    private readonly tokenStore: IMagicLinkTokenStore,
    private readonly getMailer: () => IMailer,
    private readonly sessionStore: ISessionStore,
    private readonly userQuery: IUserQueryRepository,
    private readonly userCommand: IUserCommandRepository,
  ) {}

  /**
   * magic link を発行してメールで送る。
   * トークンとリンクの URL 生成は分離し、URL の組み立て (ルーティング) は呼び出し側から注入する。
   */
  async requestMagicLink(
    email: Email,
    verifyUrlFor: (token: string) => string,
  ): Promise<void> {
    const token = await this.tokenStore.issue(email.toString());
    const mailer = this.getMailer();
    await mailer.send({
      to: email.toString(),
      subject: "Sign in to your account",
      body: `Click the link below to sign in (valid for 15 minutes):\n\n${verifyUrlFor(token)}`,
    });
  }

  /**
   * magic link のトークンを検証 (use-once 消費) し、成功したらセッションを確立する。
   * トークンが無効・期限切れの場合は undefined を返す。
   */
  async verifyMagicLink(
    token: string,
  ): Promise<undefined | { user: User; sessionId: string }> {
    const consumed = await this.tokenStore.consume(token);
    if (consumed === undefined) return undefined;

    const email = Email.create(consumed.email);
    return this.signInWithVerifiedEmail(email);
  }

  /**
   * 本人確認済みの email を前提に、ユーザーを確保 (無ければ作成) してセッションを発行する。
   * すべての認証方式が最終的に合流する地点。
   */
  async signInWithVerifiedEmail(
    email: Email,
  ): Promise<{ user: User; sessionId: string }> {
    const user = await this.ensureUser(email);
    const sessionId = await this.sessionStore.create(user.id);
    return { user, sessionId };
  }

  /**
   * email に対応するユーザーを取得し、無ければ作成する (get-or-create)。
   *
   * find → save の間に別リクエストが同じ email を作成する競合 (TOCTOU) に備え、
   * save が DuplicateEmailError を投げたら取り直す。これにより同時サインインでも
   * 二重作成・未処理の制約違反 (静かな 500) を起こさない。
   */
  private async ensureUser(email: Email): Promise<User> {
    const existing = await this.userQuery.findByEmail(email);
    if (existing !== undefined) return existing;

    try {
      // displayName を渡さない → User の既定 (メアドのローカル部) が適用される。
      return await this.userCommand.save(User.create({ email }));
    } catch (error) {
      if (error instanceof DuplicateEmailError) {
        const created = await this.userQuery.findByEmail(email);
        if (created !== undefined) return created;
      }
      throw error;
    }
  }
}
