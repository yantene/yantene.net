/**
 * ISO 日付文字列 ("YYYY-MM-DD") を、読み手の言語の表記にする。
 *
 * **`new Date("1993-11-18")` を読み手の時間帯で組まない。** あれは UTC の 0 時として
 * 解釈されるので、UTC より西の時間帯では前日になる。SSR (UTC) と手元のブラウザで
 * 1 日ずれ、hydration の食い違いとして表に出る。時間帯を UTC に固定して組み立てる。
 *
 * 読むのは渡された日付だけで、時計には触らない (Workers ではモジュールの評価時の時刻が
 * 1970 年に固まる。architecture.md の「モジュールスコープで時刻を読まない」)。
 */
export function formatPlainDate(iso: string, locale: string): string {
  const [year, month, day] = iso.split("-").map(Number);
  if (year === undefined || month === undefined || day === undefined) return iso;

  return new Intl.DateTimeFormat(locale, {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
