import { runRefresh } from "./run-refresh";
import { ConsoleLogger } from "~/backend/infra/console/console-logger";

/** 購読する Artifacts のイベント。 */
const PUSHED_EVENT_TYPE = "cf.artifacts.repo.pushed";

/**
 * Artifacts が流す push イベント。`payload.ref` は `refs/heads/<branch>` の形で来る。
 * 使うのは種別と送り元と ref だけなので、それ以外は読まない。
 */
interface ArtifactsPushedEvent {
  readonly type: string;
  readonly source?: { readonly namespace?: unknown; readonly repoName?: unknown };
  readonly payload?: { readonly ref?: unknown };
}

/**
 * 読んでいるコンテンツリポジトリのブランチへの push か。
 *
 * 送り元 (namespace / repo) も見る。購読をアカウント単位で張ると、同じアカウントの
 * 別のリポジトリへの push もここへ来るため。
 */
function isPushToWatchedBranch(body: unknown, env: Env): boolean {
  if (typeof body !== "object" || body === null) return false;
  const event = body as ArtifactsPushedEvent;
  if (event.type !== PUSHED_EVENT_TYPE) return false;
  if (event.source?.namespace !== env.ARTIFACTS_NAMESPACE) return false;
  if (event.source?.repoName !== env.ARTIFACTS_REPO) return false;
  return event.payload?.ref === `refs/heads/${env.ARTIFACTS_BRANCH}`;
}

/**
 * コンテンツリポジトリへの push で同期を起こす (Composition Root)。
 *
 * **1 バッチにつき refresh は多くても 1 回。** 立て続けの push は 1 回の同期にまとまる。
 * refresh はコンテンツリポジトリの「いまの姿」を D1 / R2 に揃える処理で、コミットを 1 つずつ辿るのでは
 * ないため、まとめても取りこぼさない。
 *
 * 読んでいるコンテンツリポジトリが Artifacts でない環境 (`CONTENT_SOURCE` が `github`) では何もしない。
 * そこで走らせても、Artifacts の push を合図に GitHub の中身を同期することになる。
 *
 * 失敗したら ack せずに投げ返す。Queue が再試行する。
 */
export async function handleRefreshQueue(batch: MessageBatch, env: Env): Promise<void> {
  const logger = new ConsoleLogger({ component: "refresh-queue" });

  // wrangler が生成する型は、いま設定してある値のリテラルに固まる。切り替えの前後で
  // 型エラーにならないよう、ここでは文字列として比べる (resolve-content-store と同じ)。
  const contentSource: string = env.CONTENT_SOURCE;
  if (contentSource !== "artifacts") {
    logger.info("コンテンツリポジトリが Artifacts ではないので push イベントを読み飛ばす", {
      contentSource,
      messages: batch.messages.length,
    });
    batch.ackAll();
    return;
  }

  const branch = env.ARTIFACTS_BRANCH;
  const targeted = batch.messages.filter((message) => isPushToWatchedBranch(message.body, env));
  if (targeted.length === 0) {
    logger.info("同期の要らないイベントだった", { branch, messages: batch.messages.length });
    batch.ackAll();
    return;
  }

  logger.info("push を受けて同期する", { branch, pushes: targeted.length });
  const result = await runRefresh(env, { force: false });
  logger.info("同期が終わった", { result });
  batch.ackAll();
}
