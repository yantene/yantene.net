import { describe, expect, it } from "vitest";
import { isExternalHref } from "./href";

describe("isExternalHref", () => {
  // eslint-disable-next-line unicorn/prefer-https -- http と https の両方を外部として扱うことが眼目
  it.each(["http://example.com/", "https://example.com/"])("http(s) は外部 (%s)", (href) => {
    expect(isExternalHref(href)).toBe(true);
  });

  /* ブラウザが普通に開く書き方。rel と target を付け損なっていた (#306)。 */
  it.each(["HTTPS://example.com/", "HtTp://example.com/"])(
    "スキームが大文字でも外部 (%s)",
    (href) => {
      expect(isExternalHref(href)).toBe(true);
    },
  );

  /*
   * 文書の中では現在のスキームが補われ、よそのホストへ出る。href に置いてよいかの
   * 判定 (isHttpUrl) はこれを通さないが、別タブで開くかどうかは別の問い。
   */
  it("プロトコル相対も外部", () => {
    expect(isExternalHref("//example.com/")).toBe(true);
  });

  it.each(["/notes/x", "#top", "./a.png", "mailto:a@example.com", ""])(
    "外部でないもの (%s)",
    (href) => {
      expect(isExternalHref(href)).toBe(false);
    },
  );

  it("出どころを渡さなければ、自分のサイトでも絶対 URL は外部", () => {
    // Storybook など出どころの決まらない場所では、安全側 (別タブ + rel) に倒す。
    expect(isExternalHref("https://yantene.net/notes/x")).toBe(true);
  });

  describe("出どころを渡したとき", () => {
    const origin = "https://yantene.net";

    /*
     * 自分のページが別タブで開き、自分の記事同士のリンクに nofollow が付いていた。
     * 検索エンジンに「この先は辿らなくてよい」と言っているのと同じだった (#318)。
     */
    it("同じ出どころなら内部", () => {
      expect(isExternalHref("https://yantene.net/notes/x", origin)).toBe(false);
    });

    it("ポートまで含めて見る", () => {
      expect(isExternalHref("https://yantene.net:8443/notes/x", origin)).toBe(true);
    });

    it("スキームが違えば外部", () => {
      // eslint-disable-next-line unicorn/prefer-https -- http と https が別の出どころであることが眼目
      expect(isExternalHref("http://yantene.net/notes/x", origin)).toBe(true);
    });

    /*
     * 文字列の前方一致で見ると通ってしまう。origin どうしで比べること。
     */
    it("出どころを名前に含めるだけの別ホストは外部", () => {
      expect(isExternalHref("https://yantene.net.evil.example/x", origin)).toBe(true);
      expect(isExternalHref("https://evil.example/?u=https://yantene.net", origin)).toBe(true);
    });

    it("よそのサイトは外部のまま", () => {
      expect(isExternalHref("https://example.com/", origin)).toBe(true);
    });

    /*
     * 補われるスキームは読み手の見ているページ次第で、こちらでは決められない。
     */
    it("プロトコル相対は出どころが分かっても外部", () => {
      expect(isExternalHref("//yantene.net/notes/x", origin)).toBe(true);
    });

    it("出どころが URL として読めなければ内部と決めつけない", () => {
      expect(isExternalHref("https://yantene.net/x", "not a url")).toBe(true);
    });

    it("絶対 URL でないものは変わらず内部", () => {
      expect(isExternalHref("/notes/x", origin)).toBe(false);
    });
  });
});
