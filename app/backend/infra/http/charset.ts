/*
 * 外から取ってきた本文を、相手が名乗った文字コードで読むための道具。
 *
 * リンクカードの OGP と Webmention の送り元 HTML が同じ判断をする。片方だけ UTF-8 の
 * 決め打ちに戻ると、そちらだけ静かに文字化けするので 1 か所に置く。
 */

/**
 * 文字コードの宣言を探す窓。
 *
 * HTML の仕様は宣言を「先頭 1024 バイト以内」かつ ASCII 互換の綴りで書くことを求めて
 * いる。だからここだけを ASCII として走査すれば足り、「相手の HTML を読むには相手の
 * 文字コードが要る」という循環には踏み込まずに済む。
 */
const PRESCAN_BYTES = 1024;

/**
 * 宣言を ASCII として読むための文字コード。
 *
 * latin1 はバイトと符号位置が 1 対 1 で対応するので、中身が何であれタグの綴りが崩れ
 * ない。UTF-8 として読むと、壊れた並びが後続のバイトごと置換文字に畳まれることがある。
 */
const PRESCAN_CHARSET = "latin1";

/** meta 要素と、その属性の並び。 */
const metaTag = /<meta\b([^>]*)>/gi;

/** 属性の並びの中の charset。`charset=` と `content="...; charset=..."` の両方に当たる。 */
const charsetAttribute = /charset\s*=\s*["']?([^"'\s;/>]+)/i;

/** Content-Type が名乗る文字コード。名乗っていなければ undefined。 */
export function charsetOf(contentType: string | null): string | undefined {
  const found = /;\s*charset\s*=\s*"?([^";]+)"?/i.exec(contentType ?? "");
  return found?.[1]?.trim();
}

/**
 * 本文の `<meta>` が名乗る文字コード。名乗っていなければ undefined。
 *
 * `<meta charset="...">` と `<meta http-equiv="content-type" content="...; charset=...">`
 * のどちらの書き方も拾う。
 */
export function charsetFromMeta(bytes: Uint8Array): string | undefined {
  const head = decoderFor(PRESCAN_CHARSET).decode(bytes.subarray(0, PRESCAN_BYTES));
  // meta を 1 つずつ取り出してから属性を見る。1 本の式にまとめると後戻りが起きる。
  for (const [, attributes] of head.matchAll(metaTag)) {
    const charset = charsetAttribute.exec(attributes)?.[1];
    if (charset !== undefined) return charset;
  }
  return undefined;
}

/**
 * この本文をどの文字コードで読むか。名乗りが無ければ undefined (= UTF-8 に倒す)。
 *
 * Content-Type を先に見るのは、HTML の仕様がその順で決めているため。ヘッダーで名乗る
 * 相手のほうが多いので、多くの場合は本文を覗かずに済む。
 */
export function charsetFor(contentType: string | null, bytes: Uint8Array): string | undefined {
  return charsetOf(contentType) ?? charsetFromMeta(bytes);
}

/**
 * その文字コードの復号器。名乗りが無い / 知らない名前なら UTF-8 に倒す。
 *
 * 日本語圏の個人サイトには Shift_JIS や EUC-JP のページが残っている。決め打ちで UTF-8 に
 * すると、カードの題も送り主の名前も文字化けしたまま保存されてしまう。
 */
export function decoderFor(charset: string | undefined): TextDecoder {
  if (charset === undefined) return new TextDecoder();
  try {
    return new TextDecoder(charset);
  } catch {
    return new TextDecoder();
  }
}
