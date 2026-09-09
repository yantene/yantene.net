import { Temporal } from "@js-temporal/polyfill";
import { NoteSlug } from "~/backend/domain/note";
import { viewWeightLog } from "~/backend/domain/note-view";
import { Session, SessionId } from "~/backend/domain/session";
import { buildSessionCookie, readSessionId } from "~/backend/handlers/session-cookie";
import { ConsoleLogger } from "~/backend/infra/console/console-logger";
import { D1NoteViewCommandRepository } from "~/backend/infra/d1/repositories";
import {
  KvSessionCommandRepository,
  KvSessionQueryRepository,
} from "~/backend/infra/kv/repositories";

/**
 * 閲覧を記録するために呼び出し側から預かるもの。
 *
 * 記録はページの描画に必要ないので、応答を返し終えてから走らせる (waitUntil)。
 * 記録しない場面 (JSON API など) では null を渡す。省略できる形にしていないのは、
 * 渡し忘れで静かに数が落ちるのを防ぐため。
 */
export interface NoteViewRecording {
  readonly userAgent: string | null;
  /** 受け取った Cookie ヘッダー。セッション識別子を取り出すのに使う。 */
  readonly cookie: string | null;
  readonly waitUntil: (promise: Promise<unknown>) => void;
  /** セッション識別子を預け直す Set-Cookie を応答に載せる。 */
  readonly setCookie: (value: string) => void;
}

/** 読まれたノート。数を足すのに id が、読み直しの判定に slug が要る。 */
export interface ViewedNoteRef {
  readonly id: string;
  readonly slug: string;
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
 * ノートが読まれたことを数に足す。
 *
 * 同じ人が同じ日に同じ記事を開き直したぶんは数えない。誰が何を読んだかはセッション
 * (KV) が持ち、読み手のブラウザには KV を指す識別子だけを預ける。
 *
 * セッションを起こすのは人が読んだときだけ。クローラーに識別子を配っても意味がない。
 */
export function recordNoteView(env: Env, note: ViewedNoteRef, recording: NoteViewRecording): void {
  if (isLikelyBot(recording.userAgent)) return;

  // 持っていれば引き継ぐ。読めない値なら発行し直す (なりすましは形の検証では防げず、
  // 防ぐ必要もない。当てられない乱数であることだけが効いている)。
  const sessionId = readSessionId(recording.cookie) ?? SessionId.issue();
  recording.setCookie(
    buildSessionCookie(sessionId, {
      // CSP と同じく、development でだけ外す (ADR 0007)。dev は http で開くことが
      // あり、Secure を付けると cookie が落ちてセッションが繋がらなくなる。
      secure: env.APP_ENV !== "development",
    }),
  );

  // 日付は UTC で切る。閲覧者の時間帯ごとに日が変わると、重みが土地によってずれる。
  const viewedOn = Temporal.Now.plainDateISO("UTC");

  // 留保事項: 記録は応答を返し終えてから走るので、1 秒ほどの間に同じ記事を続けて
  // 開かれると、2 つ目がこの書き込みより先に読んでしまい両方とも数える。KV の結果
  // 整合も重なるが、主因はここで後ろに回していること。人のリロードでは滅多に当たらず、
  // 順位の目安としては誤差なので許容している (ADR 0011)。
  recording.waitUntil(applyView(env, sessionId, note, viewedOn));
}

/**
 * セッションに「今日この記事を数えた」を書き、それから数を足す。
 *
 * 先にセッションを書くのは、途中で落ちたときに数え過ぎより数え落としを選ぶため。
 * 逆順にすると、書き込みに失敗した回だけ何度でも数えられてしまい、読み直しを
 * 数えないという目的そのものが崩れる。
 */
async function applyView(
  env: Env,
  sessionId: SessionId,
  note: ViewedNoteRef,
  viewedOn: Temporal.PlainDate,
): Promise<void> {
  try {
    const slug = NoteSlug.create(note.slug);
    const session =
      (await new KvSessionQueryRepository(env.SESSIONS).findById(sessionId)) ??
      Session.start(sessionId, viewedOn);
    if (session.hasViewed(slug, viewedOn)) return;

    await new KvSessionCommandRepository(env.SESSIONS).save(session.withView(slug, viewedOn));

    // 重みは日付だけから決まる。足すのは SQL 側で、いまの値から作らせる。
    await new D1NoteViewCommandRepository(env.D1).addView(
      note.id,
      viewWeightLog(viewedOn.toString()),
    );
  } catch (error) {
    // 記録に失敗しても読む側には関係がないので、握って記録だけ残す。
    new ConsoleLogger().error("failed to record a note view", {
      noteId: note.id,
      viewedOn: viewedOn.toString(),
      error,
    });
  }
}
