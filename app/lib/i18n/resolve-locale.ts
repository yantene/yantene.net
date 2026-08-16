import {
  isSupportedLocale,
  localeCookieName,
  type SupportedLocale,
} from "~/lib/i18n/locale";

/**
 * Cookie ヘッダーから、読める locale を取り出す。無ければ undefined。
 *
 * **百分率符号化は解かない。** 解いていたときは `Cookie: locale=%` を送るだけで
 * `decodeURIComponent` が URIError を投げ、**その相手にはサイトの全ページが 500 に
 * なっていた** (#309)。cookie の中身は読み手が好きに決められるうえ、cookie は消すまで
 * 送られ続けるので、一度そうなると開けなくなる。
 *
 * 解かなくても困らない。通すのは `en` と `ja` だけで、どちらも符号化しても同じ文字列に
 * なる。cookie を書く側もこのリポジトリには居ない。同じ Cookie ヘッダーを読む
 * `handlers/session-cookie.ts` の pickCookie も解いていない。
 *
 * **名前が一致した最初のものではなく、読める最初のものを返す。** `locale=%; locale=ja`
 * のように同じ名前が並ぶことがあり (ドメインやパスの違う cookie が両方送られる)、
 * 先頭だけを見ると後ろにある正しい値が黙って捨てられる。
 */
function readLocaleCookie(cookieHeader: string): SupportedLocale | undefined {
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.split("=");
    if (name.trim() !== localeCookieName) continue;

    const value = rest.join("=").trim();
    if (isSupportedLocale(value)) return value;
  }
  return undefined;
}

/**
 * Accept-Language ヘッダーから優先度の高い順に走査し、最初にマッチした
 * SupportedLocale を返す。q 値の重み付けは扱わず、書かれた順 (= 優先順) で判定する。
 */
function parseAcceptLanguage(header: string): SupportedLocale | undefined {
  for (const part of header.split(",")) {
    const tag = part.split(";", 1)[0].trim().toLowerCase().slice(0, 2);
    if (tag.length > 0 && isSupportedLocale(tag)) return tag;
  }
  return undefined;
}

/**
 * リクエストから表示ロケールを決める。locale クッキーを優先し、
 * 無ければ Accept-Language、どちらも無ければ "en" にフォールバックする。
 */
export function resolveLocale(request: Request): SupportedLocale {
  return (
    readLocaleCookie(request.headers.get("Cookie") ?? "") ??
    parseAcceptLanguage(request.headers.get("Accept-Language") ?? "") ??
    "en"
  );
}
