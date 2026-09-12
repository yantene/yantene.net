import { ConsoleLogger } from "~/backend/infra/console/console-logger";

/** 記録に載せるメッセージの本文の長さの上限。 */
const MAX_BODY = 500;

/**
 * 再試行を使い切った push イベントの行き先 (Composition Root)。
 *
 * `refresh-queue` の consumer が `max_retries` 回落ちると、メッセージはここへ回る。
 * **やることは記録に残して ack するだけ**で、同期はやり直さない。落ちた原因が直るまで
 * 何度やっても落ちるうえ、次の push が来れば refresh はコンテンツリポジトリのいまの姿に
 * 揃えるので、取りこぼした 1 通を追いかける意味が無いため。
 *
 * **ack しないと元の queue に戻せる先が無く、メッセージは期限まで滞留する。**
 * 滞留させても誰も見ないので、残すのは記録のほうにする。
 *
 * 気づく手立てはこの `error` の記録そのもの (Workers Logs / `wrangler tail` に出る)。
 * 通知を飛ばすのはここではなく Cloudflare 側の alert で行う。
 */
export function handleRefreshDeadLetter(batch: MessageBatch, env: Env): void {
  const logger = new ConsoleLogger({ component: "refresh-dead-letter" });

  logger.error("同期が再試行を使い切った。コンテンツリポジトリの中身が D1 / R2 に届いていない", {
    queue: batch.queue,
    messages: batch.messages.length,
    repo: `${env.ARTIFACTS_NAMESPACE}/${env.ARTIFACTS_REPO}`,
    branch: env.ARTIFACTS_BRANCH,
    // 本文をそのまま載せる。何の push を取りこぼしたのかは、ここにしか残らない。
    bodies: batch.messages.map((message) => JSON.stringify(message.body).slice(0, MAX_BODY)),
  });

  batch.ackAll();
}
