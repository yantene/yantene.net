/*
 * @vitest-environment node
 *
 * `Cookie` は Fetch 仕様の禁止ヘッダーで、happy-dom の Request は組み立て時に落とす。
 * ここで見たいのは Workers が受け取る姿なので、素の実装で走らせる。
 */
import { describe, expect, it } from "vitest";
import { localeCookieName } from "~/lib/i18n/locale";
import { resolveLocale } from "~/lib/i18n/resolve-locale";

function requestWith(headers: Record<string, string>): Request {
  return new Request("https://yantene.net/", { headers });
}

function withCookie(value: string): Request {
  return requestWith({ Cookie: `${localeCookieName}=${value}` });
}

describe("resolveLocale", () => {
  it("cookie の値を読む", () => {
    expect(resolveLocale(withCookie("ja"))).toBe("ja");
    expect(resolveLocale(withCookie("en"))).toBe("en");
  });

  /* 読み手が選んだ言語を、ブラウザの申告で上書きしない。 */
  it("cookie を Accept-Language より優先する", () => {
    const request = requestWith({
      Cookie: `${localeCookieName}=en`,
      "Accept-Language": "ja",
    });

    expect(resolveLocale(request)).toBe("en");
  });

  it("cookie が無ければ Accept-Language を見る", () => {
    expect(
      resolveLocale(requestWith({ "Accept-Language": "ja,en;q=0.9" })),
    ).toBe("ja");
  });

  /*
   * q 値の重み付けは扱わず、書かれた順で判定する (resolve-locale.ts の注記どおり)。
   * 順で決めていることをここで固定しないと、q を見る実装に変えても気づけない。
   */
  it("Accept-Language は q 値ではなく書かれた順で読む", () => {
    expect(
      resolveLocale(requestWith({ "Accept-Language": "en;q=0.1,ja;q=0.9" })),
    ).toBe("en");
  });

  it("どちらも無ければ en", () => {
    expect(resolveLocale(requestWith({}))).toBe("en");
  });

  it("知らない値の cookie は Accept-Language に譲る", () => {
    expect(
      resolveLocale(
        requestWith({
          Cookie: `${localeCookieName}=fr`,
          "Accept-Language": "ja",
        }),
      ),
    ).toBe("ja");
  });
});

/*
 * cookie の中身は読み手が好きに決められる。以前はこれを decodeURIComponent に渡していて、
 * `Cookie: locale=%` を送るだけで URIError が飛び、その相手にはサイトの全ページが
 * 500 になっていた (#309)。理由は resolve-locale.ts の readLocaleCookie を参照。
 */
describe("resolveLocale: 読み手が壊した cookie", () => {
  it.each(["%", "50%off", "%zz", "%e3%81", '"ja"', ""])(
    "落ちずに既定へ倒す (%s)",
    (value) => {
      expect(resolveLocale(withCookie(value))).toBe("en");
    },
  );

  it("読めない値は Accept-Language に譲る", () => {
    const request = requestWith({
      Cookie: `${localeCookieName}=%`,
      "Accept-Language": "ja",
    });

    expect(resolveLocale(request)).toBe("ja");
  });

  /*
   * 同じ名前の cookie は並ぶことがある (ドメインやパスの違うものが両方送られる)。
   * 先頭だけを見ると、後ろにある正しい値が黙って捨てられる。読み手はもう一度
   * 設定し直しても直せない。
   */
  it("読めない値が先にあっても、後ろの読める値を拾う", () => {
    const request = requestWith({
      Cookie: `${localeCookieName}=%; ${localeCookieName}=ja`,
    });

    expect(resolveLocale(request)).toBe("ja");
  });
});
