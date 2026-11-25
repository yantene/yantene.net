import { resolveAdminEmail, resolveMailFrom } from "~/backend/handlers/auth/resolve-sign-in";
import { ConsoleLogger } from "~/backend/infra/console/console-logger";
import { D1NotificationQuotaCommandRepository } from "~/backend/infra/d1/repositories";
import { CloudflareMailer } from "~/backend/infra/email/cloudflare-mailer";
import { ReactionNotificationService } from "~/backend/services/reaction-notification.service";

/**
 * 1 日に送るリアクションの通知の上限。
 *
 * いまはリアクションの POST を cookie 無しでも受けるので、ボットが押すたびに新しい
 * リアクションとして数えられる。対策が入るまでは、この上限が受信箱を守る唯一の
 * 歯止めになる (#593)。人の手で押される数がこれを超える日はまず無い。
 */
export const REACTION_MAIL_DAILY_LIMIT = 30;

/**
 * 件名の頭に付ける環境の印。production だけ付けない。
 *
 * staging にも同じ `ADMIN_EMAIL` が入っているので、印が無いと staging で試しに
 * 押した分と本物の読み手が押した分を受信箱で見分けられない。
 */
function subjectPrefixFor(env: Env): string {
  return env.APP_ENV === "production" ? "" : `[${env.APP_ENV}] `;
}

/** Composition Root: env からリアクションの通知を組み立てる。 */
export function resolveReactionNotifier(env: Env): ReactionNotificationService {
  const to = resolveAdminEmail(env);
  return new ReactionNotificationService({
    // 書き手宛てなので、返事の行き先を分ける必要は無い。
    mailer: new CloudflareMailer(env.EMAIL, resolveMailFrom(env), ""),
    quota: new D1NotificationQuotaCommandRepository(env.D1),
    to,
    dailyLimit: REACTION_MAIL_DAILY_LIMIT,
    subjectPrefix: subjectPrefixFor(env),
    logger: new ConsoleLogger({ service: "reaction-notification" }),
  });
}
