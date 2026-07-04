import type { IMailer } from "~/backend/domain/auth";

/**
 * メールを送信せず、ペイロードを stdout に JSON で書き出すだけの実装。
 * 開発・テスト用途。本番では Resend / SendGrid / Postmark などの実装に差し替える。
 */
export class ConsoleMailer implements IMailer {
  send(params: { to: string; subject: string; body: string }): Promise<void> {
    console.info(
      JSON.stringify({
        kind: "mail",
        to: params.to,
        subject: params.subject,
        body: params.body,
      }),
    );
    return Promise.resolve();
  }
}
