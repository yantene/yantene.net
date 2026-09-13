import type { EmailAddress, IRateLimiter } from "~/backend/domain/auth";
import { EmailAddress as EmailAddressVo } from "~/backend/domain/auth";
import { ConsoleLogger } from "~/backend/infra/console/console-logger";
import { CloudflareMailer } from "~/backend/infra/email/cloudflare-mailer";
import {
  D1SignInTokenCommandRepository,
  D1SignInTokenQueryRepository,
} from "~/backend/infra/d1/repositories";
import {
  KvAuthSessionCommandRepository,
  KvAuthSessionQueryRepository,
} from "~/backend/infra/kv/repositories";
import { BindingRateLimiter } from "~/backend/infra/rate-limit/binding-rate-limiter";
import { SignInService } from "~/backend/services/sign-in.service";

/**
 * cookie に `Secure` を付けるか。
 *
 * development 以外では必ず付ける。**想定外の `APP_ENV` も付ける側に倒す**
 * (secure by default)。CSP の判断 (ADR 0007) と同じ形。
 */
export function shouldUseSecureCookie(env: Env): boolean {
  return env.APP_ENV !== "development";
}

/**
 * 管理者として扱うアドレス。置かれていなければ undefined。
 *
 * **役割はここでしか決まらない** (ADR 0039)。セッションには焼き付けないので、
 * この値を変えれば次の要求から効く。
 */
export function resolveAdminEmail(env: Env): EmailAddress | undefined {
  const raw = env.ADMIN_EMAIL;
  if (typeof raw !== "string" || raw.length === 0) return undefined;

  const email = EmailAddressVo.parse(raw);
  if (email === undefined) {
    // 読めない値を黙って捨てると、打ち間違いが「誰も入れない」としてしか見えない。
    new ConsoleLogger().error("ADMIN_EMAIL is set but is not a readable email address");
  }
  return email;
}

/**
 * リンクを送ってよいアドレスの集合。
 *
 * **いまは管理者の 1 つに等しい** (ADR 0039)。置き忘れた環境では空になり、誰も
 * 入れない。黙って全員を通すよりよいが、設定の抜けが見えるように記録は残す。
 */
function resolveAllowedEmails(env: Env): readonly EmailAddress[] {
  const admin = resolveAdminEmail(env);
  if (admin === undefined) {
    new ConsoleLogger().warn("ADMIN_EMAIL is not set; nobody can sign in");
    return [];
  }
  return [admin];
}

/**
 * 差出人のアドレス。置かれていなければ空。
 *
 * **ここでは投げない。** 投げると、配信と関係の無い経路 (ログイン中かを見るだけの
 * 要求) まで巻き込まれる。足りないことに気づかせるのは送る直前 (CloudflareMailer)。
 */
function resolveMailFrom(env: Env): string {
  const from = env.MAIL_FROM;
  return typeof from === "string" ? from : "";
}

/**
 * Composition Root: env からログインのサービスを組み立てる。
 *
 * リンクは D1、セッションは KV、配信は Cloudflare Email Sending (ADR 0039)。
 */
export function resolveSignInService(env: Env): SignInService {
  return new SignInService({
    tokenCommand: new D1SignInTokenCommandRepository(env.D1),
    tokenQuery: new D1SignInTokenQueryRepository(env.D1),
    sessionCommand: new KvAuthSessionCommandRepository(env.SESSIONS),
    sessionQuery: new KvAuthSessionQueryRepository(env.SESSIONS),
    mailer: new CloudflareMailer(
      env.EMAIL,
      resolveMailFrom(env),
      // 返事は普段のアドレスへ。差出人のドメインは送信専用で受け取れない。
      resolveAdminEmail(env)?.toString() ?? "",
    ),
    logger: new ConsoleLogger({ service: "sign-in" }),
    allowedEmails: resolveAllowedEmails(env),
  });
}

export function resolveRateLimiter(env: Env): IRateLimiter {
  return new BindingRateLimiter(env.RATE_LIMIT);
}
