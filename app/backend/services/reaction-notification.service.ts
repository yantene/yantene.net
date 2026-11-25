import { buildReactionMail } from "./reaction-mail";
import type { EmailAddress, IMailer } from "~/backend/domain/auth";
import type { INotificationQuotaCommandRepository } from "~/backend/domain/notification";
import type { ILogger } from "~/backend/domain/shared";
import { errorToContext } from "~/backend/domain/shared";

/** 枠を数えるときの通知の種類。 */
const CHANNEL = "reaction-mail";

/** 知らせる 1 件。付いた後の姿で渡す。 */
export interface ReactionNotice {
  readonly articleTitle: string;
  readonly articleUrl: string;
  readonly emoji: string;
  /** 付け替えなら前の絵文字。新しく付いたなら undefined。 */
  readonly previous: string | undefined;
  readonly reactions: readonly { readonly emoji: string; readonly count: number }[];
  /** 枠を数える日 (UTC)。 */
  readonly day: string;
}

export interface ReactionNotificationDeps {
  readonly mailer: IMailer;
  readonly quota: INotificationQuotaCommandRepository;
  /** 宛先。置かれていなければ送らない。 */
  readonly to: EmailAddress | undefined;
  /** 1 日に送る上限。 */
  readonly dailyLimit: number;
  readonly subjectPrefix: string;
  readonly logger: ILogger;
}

/**
 * リアクションが付いたことを書き手にメールで知らせる。
 *
 * **リアクションの結果は変えない。** 送れなくても、枠を使い切っていても、投げずに
 * 記録だけ残す。読み手から見れば押せたかどうかがすべてで、通知の都合で押せなかった
 * ことにはしない。
 *
 * **枠を取ってから送る。** 逆にすると、送信に失敗し続ける限り枠を食わずに何度でも
 * 送れてしまう。そのかわり、送れなかった回も 1 通に数える。
 */
export class ReactionNotificationService {
  constructor(private readonly deps: ReactionNotificationDeps) {}

  async notify(notice: ReactionNotice): Promise<void> {
    const { logger } = this.deps;
    const to = this.deps.to;
    if (to === undefined) {
      logger.warn("ADMIN_EMAIL is not set; the reaction mail is not sent");
      return;
    }

    const taken = await this.takeQuota(notice.day);
    if (taken === "failed") return;
    if (!taken) {
      logger.warn("the daily limit of reaction mails is reached; the mail is not sent", {
        day: notice.day,
        dailyLimit: this.deps.dailyLimit,
      });
      return;
    }

    try {
      await this.deps.mailer.send(
        buildReactionMail({ to, subjectPrefix: this.deps.subjectPrefix, ...notice }),
      );
    } catch (error) {
      logger.error("failed to send the reaction mail", errorToContext(error));
    }
  }

  /**
   * その日の枠を 1 通ぶん取る。数えられなければ記録を残して "failed" を返す。
   *
   * 数えられないときは送らない側に倒す。上限が受信箱を守る唯一の歯止めなので。
   */
  private async takeQuota(day: string): Promise<boolean | "failed"> {
    try {
      return await this.deps.quota.tryTake({
        channel: CHANNEL,
        day,
        limit: this.deps.dailyLimit,
      });
    } catch (error) {
      this.deps.logger.error("failed to take the reaction mail quota", errorToContext(error));
      return "failed";
    }
  }
}
