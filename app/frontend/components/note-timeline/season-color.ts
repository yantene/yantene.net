/**
 * 公開日を 1 年の位相に見立て、タイムラインのドットに当てる色を決める。
 *
 * 色そのものではなくクラス名を返すのは CSP の都合。`style-src 'self'` 下では
 * inline style 属性が丸ごと無視されるため、連続値の色を JS から渡す手が使えない
 * (ADR 0007)。可変軸は静的な CSS クラスの段階として持つ。
 *
 * 段階は月単位の 12 分割。日単位まで刻んでも、白地の小さな点では隣接する日の差を
 * 判別できず、CSS だけが 365 行に膨らむ。
 */

/** 月 (1〜12) → ドットのクラス名。実際の色は note-timeline.css が持つ。 */
export function seasonDotClass(publishedOn: string): string {
  const month = monthOf(publishedOn);
  return `note-dot-m${String(month).padStart(2, "0")}`;
}

/**
 * `YYYY-MM-DD` から月を取り出す。
 *
 * publishedOn は Temporal.PlainDate 由来なので通常この形式だが、ここは表示のための
 * 装飾でしかない。読めない値が来ても描画ごと落とさず、1 月として扱う。
 */
function monthOf(publishedOn: string): number {
  const matched = /^\d{4}-(?<month>\d{2})-\d{2}/.exec(publishedOn);
  const raw = Number(matched?.groups?.month);
  if (!Number.isSafeInteger(raw) || raw < 1 || raw > 12) return 1;
  return raw;
}
