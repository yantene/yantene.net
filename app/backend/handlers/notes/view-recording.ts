import { Temporal } from "@js-temporal/polyfill";
import { logScoreAfterView } from "~/backend/domain/note-view";
import { ConsoleLogger } from "~/backend/infra/console/console-logger";
import { D1NoteViewCommandRepository } from "~/backend/infra/d1/repositories";

/**
 * 閲覧を記録するために呼び出し側から預かるもの。
 *
 * 記録はページの描画に必要ないので、応答を返し終えてから走らせる (waitUntil)。
 * 記録しない場面 (JSON API など) では null を渡す。省略できる形にしていないのは、
 * 渡し忘れで静かに数が落ちるのを防ぐため。
 */
export interface NoteViewRecording {
  readonly userAgent: string | null;
  readonly waitUntil: (promise: Promise<unknown>) => void;
}

/*
 * 人でない相手を弾くための目印。
 *
 * 判定は完全にはならないので、疑わしいものは弾く側に倒している。人のアクセスを
 * 取りこぼしても順位が少しずれるだけだが、クローラーを数え込むと「よく読まれている」が
 * 実際に読まれた記事を指さなくなるため。
 */
const botPatterns: readonly RegExp[] = [
  // 名乗りに現れる一般的な語
  /bot|crawl|spider|slurp|scrapy|feedfetcher/i,
  // リンクを展開しに来る各種サービス
  /facebookexternalhit|embedly|whatsapp|telegram|discordbot|preview/i,
  // 人が手元から叩く道具・ライブラリ
  /curl|wget|python-requests|libwww|httpclient|okhttp/i,
  // 計測・監視の類
  /headless|lighthouse|pagespeed|gtmetrix|monitor|uptime/i,
];

/** 人が読んだとは考えにくい相手か。 */
export function isLikelyBot(userAgent: string | null): boolean {
  // 通常のブラウザは必ず名乗る。名乗らない相手は人ではないとみなす。
  if (userAgent === null || userAgent.trim() === "") return true;
  return botPatterns.some((pattern) => pattern.test(userAgent));
}

/**
 * ノートが読まれたことを日次の数に足す。
 *
 * 記録するのは記事と日付だけで、読んだ人を特定できる値は保存しない。同じ人が続けて
 * 開けばその分だけ数える (誰が読んだかを持たない以上、区別のしようがない)。
 */
export function recordNoteView(
  env: Env,
  noteId: string,
  recording: NoteViewRecording,
): void {
  if (isLikelyBot(recording.userAgent)) return;

  // 日付は UTC で切る。閲覧者の時間帯ごとに日が変わると、重みが土地によってずれる。
  const viewedOn = Temporal.Now.plainDateISO("UTC").toString();

  recording.waitUntil(applyView(env, noteId, viewedOn));
}

/**
 * いまの対数スコアを読み、その日の重みを足して書き戻す。
 *
 * 読んでから書く 2 手になるのは、対数のまま足すのに log-sum-exp が要り、SQL では
 * 書けないため。累計のほうは SQL 側で足すので取りこぼさない。
 */
async function applyView(
  env: Env,
  noteId: string,
  viewedOn: string,
): Promise<void> {
  try {
    const repository = new D1NoteViewCommandRepository(env.D1);
    const current = await repository.findLogScore(noteId);
    // 記事が無ければ何もしない (0 は「まだ読まれていない」なので記録する)。
    if (current === undefined) return;

    await repository.applyView(noteId, logScoreAfterView(current, viewedOn));
  } catch (error) {
    // 記録に失敗しても読む側には関係がないので、握って記録だけ残す。
    new ConsoleLogger().error("failed to record a note view", {
      noteId,
      viewedOn,
      error,
    });
  }
}
