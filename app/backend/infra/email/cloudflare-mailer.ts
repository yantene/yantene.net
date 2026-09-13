import type { IMailer, MailMessage } from "~/backend/domain/auth";

/** 差出人の表示名。受信箱の一覧で何から来たのかが分かる字。 */
const FROM_NAME = "yantene.net";

/**
 * Cloudflare Email Sending の `send_email` バインディングで 1 通送る実装。
 *
 * 差出人のアドレスは環境ごとに違う (`MAIL_FROM`)。返信先を分けているのは、差出人が
 * 送信専用のドメインで**受け取れない**ため。返事は普段のアドレスへ来てほしい。
 */
export class CloudflareMailer implements IMailer {
  constructor(
    private readonly binding: SendEmail,
    private readonly from: string,
    private readonly replyTo: string,
  ) {}

  /**
   * 1 通送る。設定が足りなければ投げる (fail-loud)。
   *
   * **判定を送る直前まで遅らせている。** 組み立ての時点で投げると、配信と関係の無い
   * 経路 (ログイン中かを見るだけの要求) までこの設定に巻き込まれる。
   */
  async send(message: MailMessage): Promise<void> {
    if (this.from.length === 0) {
      throw new Error("MAIL_FROM is not set; the sign-in mail cannot be sent.");
    }

    await this.binding.send({
      to: message.to.toString(),
      from: { email: this.from, name: FROM_NAME },
      ...(this.replyTo.length === 0 ? {} : { replyTo: this.replyTo }),
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}
