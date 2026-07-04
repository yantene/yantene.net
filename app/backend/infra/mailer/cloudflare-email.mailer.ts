import type { IMailer } from "~/backend/domain/auth";

/**
 * Cloudflare Email Routing の Send Email バインディング (`SendEmail`) を使う本番用 IMailer 実装。
 *
 * 送信元 (`from`) は Email Routing で検証済みドメインのアドレスである必要がある。
 * MIME の組み立ては Cloudflare 側 (builder オーバーロード) に委ねる。
 */
export class CloudflareEmailMailer implements IMailer {
  constructor(
    private readonly binding: SendEmail,
    private readonly from: string,
  ) {}

  async send(params: {
    to: string;
    subject: string;
    body: string;
  }): Promise<void> {
    await this.binding.send({
      from: this.from,
      to: params.to,
      subject: params.subject,
      text: params.body,
    });
  }
}
