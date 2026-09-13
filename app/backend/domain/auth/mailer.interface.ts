import type { EmailAddress } from "./email-address.vo";

export interface MailMessage {
  readonly to: EmailAddress;
  readonly subject: string;
  /** 素のテキスト。**必ず入れる** — これしか読まない環境がある。 */
  readonly text: string;
  readonly html: string;
}

/**
 * メールを 1 通送る口。
 *
 * ドメインは配信の仕組みを知らない。実装は `infra/email/`。
 */
export interface IMailer {
  send(message: MailMessage): Promise<void>;
}
