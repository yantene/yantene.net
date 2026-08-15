/*
 * 外から取ってきた本文を、相手が名乗った文字コードで読むための道具。
 *
 * リンクカードの OGP と Webmention の送り元 HTML が同じ判断をする。片方だけ UTF-8 の
 * 決め打ちに戻ると、そちらだけ静かに文字化けするので 1 か所に置く。
 */

/**
 * Content-Type が名乗る文字コード。名乗らなければ UTF-8 とみなす。
 *
 * 名乗りが無いときに中身 (`<meta charset>` や BOM) までは見ない。相手の HTML を
 * 読むには相手の文字コードが要る、という循環に踏み込まずに済む範囲で足りている。
 */
export function charsetOf(contentType: string | null): string {
  const found = /;\s*charset\s*=\s*"?([^";]+)"?/i.exec(contentType ?? "");
  return found?.[1]?.trim() ?? "utf8";
}

/**
 * その文字コードの復号器。知らない名前なら UTF-8 に倒す。
 *
 * 日本語圏の個人サイトには Shift_JIS や EUC-JP のページが残っている。決め打ちで UTF-8 に
 * すると、カードの題も送り主の名前も文字化けしたまま保存されてしまう。
 */
export function decoderFor(charset: string): TextDecoder {
  try {
    return new TextDecoder(charset);
  } catch {
    return new TextDecoder();
  }
}
