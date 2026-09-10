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
 * メッセージ 1 通の扱い。
 *
 * - `refresh`: 読んでいるリポジトリのブランチへの push
 * - `skip`: 別の種別のイベント、別のリポジトリ・別のブランチへの push
 * - `unrecognized`: push イベントなのに送り元か ref が読めない
 */
type Verdict = "refresh" | "skip" | "unrecognized";

/**
 * メッセージが何なのかを見分ける。
 *
 * 送り元 (namespace / repo) も見る。購読をアカウント単位で張ると、同じアカウントの
 * 別のリポジトリへの push もここへ来るため。
 *
 * push イベントなのに送り元か ref が読めないときを `skip` と分けるのは、そこを混ぜると
 * 「別ブランチへの push だった」と「イベントの形が変わって読めなくなった」が
 * 同じログになり、push しても同期されない状態に気づけなくなるため。
 */
function classify(body: unknown, env: Env): Verdict {
  if (typeof body !== "object" || body === null) return "unrecognized";
  const event = body as ArtifactsPushedEvent;
  // 種別が読めないのは「別のイベントだった」ではなく「形が変わった」。
  if (typeof event.type !== "string") return "unrecognized";
  if (event.type !== PUSHED_EVENT_TYPE) return "skip";

  const namespace = event.source?.namespace;
  const repoName = event.source?.repoName;
  const ref = event.payload?.ref;
  if (typeof namespace !== "string" || typeof repoName !== "string" || typeof ref !== "string") {
    return "unrecognized";
  }
  if (namespace !== env.ARTIFACTS_NAMESPACE || repoName !== env.ARTIFACTS_REPO) return "skip";
  return ref === `refs/heads/${env.ARTIFACTS_BRANCH}` ? "refresh" : "skip";
}

/** 読み飛ばしたメッセージの種別 (重複を畳む)。 */
function skippedTypes(messages: MessageBatch["messages"]): readonly string[] {
  const types = messages.map((message) => {
    const type = (message.body as ArtifactsPushedEvent | null)?.type;
    return typeof type === "string" ? type : "<no type>";
  });
  return [...new Set(types)];
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
  const verdicts = batch.messages.map((message) => classify(message.body, env));

  const unrecognized = verdicts.filter((verdict) => verdict === "unrecognized").length;
  if (unrecognized > 0) {
    // 形が読めないと「別ブランチへの push」と区別できない。黙って捨てると push しても
    // 同期が走らないまま気づけないので、記録に残したうえで同期へ倒す。refresh は冪等で、
    // 変わっていない記事は読み直さないため、余分に走っても害は無い (fail-loud)。
    logger.error("形の読めない push イベントが来た。安全側に倒して同期する", {
      unrecognized,
      messages: batch.messages.length,
    });
  }

  const pushes = verdicts.filter((verdict) => verdict === "refresh").length;
  if (pushes === 0 && unrecognized === 0) {
    // 読み飛ばした種別を載せる。実 push で初めて分かることがあるので、`wrangler tail` から
    // 「何が来て読み飛ばされたのか」を追えるようにしておく。
    logger.info("同期の要らないイベントだった", {
      branch,
      messages: batch.messages.length,
      types: skippedTypes(batch.messages),
    });
    batch.ackAll();
    return;
  }

  logger.info("push を受けて同期する", { branch, pushes, unrecognized });
  const result = await runRefresh(env, { force: false });
  logger.info("同期が終わった", { result });
  batch.ackAll();
}
