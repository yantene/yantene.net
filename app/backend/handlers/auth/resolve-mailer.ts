import type { IMailer } from "~/backend/domain/auth";
import { CloudflareEmailMailer } from "~/backend/infra/mailer/cloudflare-email.mailer";
import { ConsoleMailer } from "~/backend/infra/mailer/console-mailer";

/**
 * 環境に応じて IMailer 実装を解決する Composition Root のファクトリ。
 *
 * - development: ConsoleMailer (ペイロードを stdout へ書き出すだけ)
 * - staging / production: Cloudflare Email Routing で実送信する CloudflareEmailMailer。
 *   設定不備 (バインディング未配線・送信元アドレス未設定) のときは ConsoleMailer へ静かに
 *   落とさず loud に throw する。本番・ステージングで console 送信は許容しない。
 *
 * 環境判定は wrangler.jsonc の `vars.APP_ENV` を参照する (development / staging / production)。
 * 送信元アドレスはデプロイ時に `MAIL_FROM_ADDRESS` (Cloudflare の var / secret) で与える。
 */
export function resolveMailer(env: Env): IMailer {
  if (env.APP_ENV === "development") {
    return new ConsoleMailer();
  }

  // EMAIL バインディングは send_email として全環境に宣言済みで、型レベルで存在が保証される
  // (未宣言なら Env が optional になり、型エラーで気付ける)。

  // MAIL_FROM_ADDRESS はデプロイ時に与える設定 (Cloudflare の var / secret)。
  // 型付き Env には載せず、basic-auth と同様に実行時に検証する。
  const from = (env as unknown as { MAIL_FROM_ADDRESS?: unknown })
    .MAIL_FROM_ADDRESS;
  if (typeof from !== "string" || from.length === 0) {
    throw new Error(
      `MAIL_FROM_ADDRESS is required for sending email (${env.APP_ENV}).`,
    );
  }

  return new CloudflareEmailMailer(env.EMAIL, from);
}
