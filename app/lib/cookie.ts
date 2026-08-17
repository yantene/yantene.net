/**
 * Cookie ヘッダーから、その名前で送られてきた値を**書かれた順に**すべて返す。
 *
 * **百分率符号化は解かない。** 解いていたときは `Cookie: locale=%` を送るだけで
 * `decodeURIComponent` が URIError を投げ、**その相手にはサイトの全ページが 500 に
 * なっていた** (#309)。cookie の中身は読み手が好きに決められるうえ、cookie は消すまで
 * 送られ続けるので、一度そうなると開けなくなる。このサイトが読む cookie の値は
 * どれも符号化しても同じ文字列になるので、解かなくても困らない。
 *
 * **1 つに絞らないのは、同じ名前が並ぶことがあるため。** ドメインやパスの違う cookie が
 * 両方送られてくると `locale=%; locale=ja` のような並びになる。どれを採るかは呼ぶ側が
 * 決める — セッションの鍵は最初のものを、ロケールは**読める最初のもの**を採る。
 * ここで先頭だけを返すと、後者で正しい値が黙って捨てられる。
 */
export function readCookieValues(
  cookieHeader: string | null,
  name: string,
): string[] {
  if (cookieHeader === null) return [];

  return (
    cookieHeader
      .split(";")
      // `=` の無い切れ端は cookie ではない。名前だけの `locale` を値 "" として拾わない。
      .filter((part) => part.includes("="))
      .map((part) => {
        const separator = part.indexOf("=");
        return {
          name: part.slice(0, separator).trim(),
          value: part.slice(separator + 1).trim(),
        };
      })
      .filter((cookie) => cookie.name === name)
      .map((cookie) => cookie.value)
  );
}
