import { describe, expect, it } from "vitest";
import {
  logScoreAfterReaction,
  logScoreAfterReactionRemoved,
  logScoreAfterView,
  reactionWeightLog,
  VIEW_SCORE_EPOCH,
  VIEW_SCORE_HALF_LIFE_DAYS,
  viewWeightLog,
} from "./view-ranking";

/** 対数で持っている値を、比べやすいように素の重みへ戻す。 */
const plain = (logScore: number): number => Math.exp(logScore);

/** まだ読まれていない記事のスコア。出発点は投稿日の重み。 */
const unreadScore = (publishedOn: string): number => viewWeightLog(publishedOn);

/** 出発点をそろえたいときに使う、基準日ちょうどに出した記事。 */
const UNREAD = 0;

/** 基準日から days 日後の ISO 日付。 */
function dayAfterEpoch(days: number): string {
  const ms = Date.parse(`${VIEW_SCORE_EPOCH}T00:00:00Z`) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

/** その日に count 回読まれたぶんを積む。 */
function viewedTimes(initial: number, count: number, viewedOn: string): number {
  let score = initial;
  for (let i = 0; i < count; i++) score = logScoreAfterView(score, viewedOn);
  return score;
}

describe("viewWeightLog", () => {
  it("基準日のアクセスの重みは 1", () => {
    expect(plain(viewWeightLog(VIEW_SCORE_EPOCH))).toBeCloseTo(1, 9);
  });

  it("半減期ぶん経つと重みが 2 倍になる", () => {
    expect(
      plain(viewWeightLog(dayAfterEpoch(VIEW_SCORE_HALF_LIFE_DAYS))),
    ).toBeCloseTo(2, 9);
    expect(
      plain(viewWeightLog(dayAfterEpoch(VIEW_SCORE_HALF_LIFE_DAYS * 2))),
    ).toBeCloseTo(4, 9);
  });

  it("基準日より前は 1 より軽くなる", () => {
    expect(
      plain(viewWeightLog(dayAfterEpoch(-VIEW_SCORE_HALF_LIFE_DAYS))),
    ).toBeCloseTo(0.5, 9);
  });
});

describe("logScoreAfterView", () => {
  it("基準日に出した未読の記事は 0 から始まる", () => {
    // 対数の 0 は素の 1。まだ読まれていなくても -∞ にはならない。
    expect(plain(UNREAD)).toBeCloseTo(1, 9);
    expect(unreadScore(VIEW_SCORE_EPOCH)).toBeCloseTo(0, 9);
  });

  it("まだ読まれていない記事同士は、新しく出した方が上に来る", () => {
    const newer = unreadScore(dayAfterEpoch(365));
    const older = unreadScore(dayAfterEpoch(30));
    expect(newer).toBeGreaterThan(older);
  });

  it("出発点が順位を左右するのは、読まれた回数がごく少ないうちだけ", () => {
    // 投稿日が離れた 2 記事を、同じ日に同じ回数だけ読ませる。
    const day = dayAfterEpoch(9700);
    const fromNewer = viewedTimes(unreadScore(dayAfterEpoch(6500)), 1, day);
    const fromOlder = viewedTimes(unreadScore(dayAfterEpoch(3800)), 1, day);
    // 1 回ぶんの重みが桁違いに大きいので、出発点の差は丸めで消える。
    // 同点の決着は SQL 側の並び順 (published_on DESC, id ASC) に任せている。
    expect(fromNewer).toBe(fromOlder);
  });

  it("初めて読まれたら、下駄にその日の重みが乗る", () => {
    const day = dayAfterEpoch(90);
    const score = logScoreAfterView(UNREAD, day);
    expect(plain(score)).toBeCloseTo(1 + plain(viewWeightLog(day)), 6);
  });

  it("同じ日に 2 回読まれたら重みが 2 つ分積まれる", () => {
    const day = dayAfterEpoch(90);
    const twice = viewedTimes(UNREAD, 2, day);
    expect(plain(twice)).toBeCloseTo(1 + plain(viewWeightLog(day)) * 2, 6);
  });

  it("後から読まれた 1 回は、半減期ぶん前の 1 回の 2 倍の重みを持つ", () => {
    const older = plain(logScoreAfterView(UNREAD, dayAfterEpoch(0))) - 1;
    const newer =
      plain(
        logScoreAfterView(UNREAD, dayAfterEpoch(VIEW_SCORE_HALF_LIFE_DAYS)),
      ) - 1;
    expect(newer / older).toBeCloseTo(2, 6);
  });

  it("古い記事が読まれ続けても、新しい少数に抜かれることがある", () => {
    // 基準日に 10 回 (重み 1 × 10) と、半減期 2 つ後に 3 回 (重み 4 × 3)。
    const old = viewedTimes(UNREAD, 10, dayAfterEpoch(0));
    const fresh = viewedTimes(
      UNREAD,
      3,
      dayAfterEpoch(VIEW_SCORE_HALF_LIFE_DAYS * 2),
    );
    expect(fresh).toBeGreaterThan(old);
    // 下駄のぶん 1 が乗る。
    expect(plain(old)).toBeCloseTo(11, 6);
    expect(plain(fresh)).toBeCloseTo(13, 6);
  });

  it("読まれ続ければ、間が空いた記事を追い越す", () => {
    let steady = UNREAD;
    for (let day = 0; day <= 120; day += 10) {
      steady = logScoreAfterView(steady, dayAfterEpoch(day));
    }
    const stale = logScoreAfterView(UNREAD, dayAfterEpoch(0));
    expect(steady).toBeGreaterThan(stale);
  });

  it("同じ日に出した記事なら、読まれた回数がそのまま順位になる", () => {
    const day = dayAfterEpoch(60);
    const many = viewedTimes(UNREAD, 5, day);
    const few = viewedTimes(UNREAD, 2, day);
    const unread = UNREAD;
    expect(many).toBeGreaterThan(few);
    expect(few).toBeGreaterThan(unread);
  });

  it("何年ぶんでも溢れない (対数のまま持つ意味)", () => {
    // 100 年ぶん先の日付でも、対数の値は有限のまま。
    const score = logScoreAfterView(UNREAD, dayAfterEpoch(36_500));
    expect(Number.isFinite(score)).toBe(true);
    // 素に戻すと倍精度では表せない大きさになる (だから対数で持っている)。
    expect(plain(score)).toBe(Infinity);
  });

  it("読めない日付は受け付けない", () => {
    expect(() => logScoreAfterView(UNREAD, "not-a-date")).toThrow(RangeError);
  });
});

describe("リアクションのスコア", () => {
  it("リアクション 1 つは閲覧 5 回ぶんの重みを持つ", () => {
    const day = dayAfterEpoch(60);
    const byReaction = logScoreAfterReaction(UNREAD, day);
    const byViews = viewedTimes(UNREAD, 5, day);

    // 出発点 (UNREAD の下駄) が両方に等しく乗っているので、素の差は消える。
    expect(plain(byReaction)).toBeCloseTo(plain(byViews), 10);
  });

  /*
   * 押して消したら元に戻ること。ここが崩れると、押し消しを繰り返すだけでスコアを
   * 上げ下げできてしまう。
   */
  it("押して消すと元のスコアに戻る", () => {
    const day = dayAfterEpoch(120);
    const before = viewedTimes(UNREAD, 30, day);

    const after = logScoreAfterReactionRemoved(
      logScoreAfterReaction(before, day),
      day,
      UNREAD,
    );

    expect(after).toBeCloseTo(before, 10);
  });

  /* 往復の丸め誤差が積もっても、順位に出る大きさにならないこと。 */
  it("押し消しを 1000 回繰り返しても元の値から動かない", () => {
    const day = dayAfterEpoch(200);
    const before = viewedTimes(UNREAD, 50, day);

    let score = before;
    for (let i = 0; i < 1000; i++) {
      score = logScoreAfterReaction(score, day);
      score = logScoreAfterReactionRemoved(score, day, UNREAD);
    }

    expect(score).toBeCloseTo(before, 9);
  });

  /* 引く値は「押した日」から作る。今日の重みで引かせない。 */
  it("押した日の重みで引く (日をまたいでも目減りしない)", () => {
    const reactedOn = dayAfterEpoch(100);
    const before = viewedTimes(UNREAD, 30, reactedOn);

    const after = logScoreAfterReactionRemoved(
      logScoreAfterReaction(before, reactedOn),
      reactedOn,
      UNREAD,
    );
    // 同じ値を引いているので、いつ消したかに関わらず元に戻る。
    expect(after).toBeCloseTo(before, 10);
  });

  /*
   * 引きすぎになる状況ではスコアを動かさない。構造上は起きないが、丸めで逆転したときに
   * -∞ を書き込むと、その記事は二度と順位に戻ってこない。
   */
  it("引きすぎるときは下限まで戻す", () => {
    const day = dayAfterEpoch(300);
    const tiny = viewWeightLog(dayAfterEpoch(0));

    const after = logScoreAfterReactionRemoved(tiny, day, tiny);

    expect(after).toBe(tiny);
    expect(Number.isFinite(after)).toBe(true);
  });

  /*
   * まだ一度も読まれていない古い記事で踏んだ穴。出発点とリアクションの重みが桁違いに
   * 離れていると、足した時点で出発点が丸めで消える。消えた値は引き戻せないので、
   * 下限を渡していないと引ききったまま戻らなくなる。
   */
  it("読まれていない古い記事でも、取り消せば出発点に戻る", () => {
    const publishedOn = dayAfterEpoch(6114); // 投稿は遠い過去
    const today = dayAfterEpoch(9720);
    const floor = viewWeightLog(publishedOn);

    const reacted = logScoreAfterReaction(floor, today);
    // 桁が離れすぎて、足した結果には出発点の情報が残っていない。
    expect(reacted).toBe(reactionWeightLog(today));

    const after = logScoreAfterReactionRemoved(reacted, today, floor);

    expect(after).toBe(floor);
  });

  it("リアクションは読まれた回数より順位を押し上げる", () => {
    const day = dayAfterEpoch(60);
    const reacted = logScoreAfterReaction(viewedTimes(UNREAD, 10, day), day);
    const readMore = viewedTimes(UNREAD, 14, day);

    expect(reacted).toBeGreaterThan(readMore);
  });
});
