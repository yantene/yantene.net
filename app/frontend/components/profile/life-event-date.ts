import type { LifeEventPrecision } from "~/backend/domain/profile";

/**
 * ライフイベントの日付を、書かれた細かさのまま日本語で組む。
 *
 * 覚えている範囲でしか書けないので、月までの出来事を 1 日に起きたことにしない。
 * 埋めた桁は出さず、`2012-04` は「2012 年 4 月」、`2016` は「2016 年」と出す。
 *
 * **英語モードでも日本語で出る。** ライフイベントの字 (題と説明) がそもそも日本語
 * なので、日付だけ英語に揃えても読み手の助けにならない (#400 の対象外)。
 *
 * 月と日のゼロ埋めは落とす。「2012 年 04 月」は日本語として読まない書き方になる。
 */
export function formatLifeEventDate(date: string, precision: LifeEventPrecision): string {
  const [year, month, day] = date.split("-");
  if (year === undefined) return date;
  if (precision === "year" || month === undefined) return `${Number(year).toString()} 年`;
  if (precision === "month" || day === undefined) {
    return `${Number(year).toString()} 年 ${Number(month).toString()} 月`;
  }
  return `${Number(year).toString()} 年 ${Number(month).toString()} 月 ${Number(day).toString()} 日`;
}
