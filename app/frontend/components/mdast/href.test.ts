import { describe, expect, it } from "vitest";
import { articleSlugOfHref, isExternalHref } from "./href";

describe("isExternalHref", () => {
  // http と https の両方を外部として扱うことが眼目
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

  it.each(["/articles/x", "#top", "./a.png", "mailto:a@example.com", ""])(
    "外部でないもの (%s)",
    (href) => {
      expect(isExternalHref(href)).toBe(false);
    },
  );

  it("出どころを渡さなければ、自分のサイトでも絶対 URL は外部", () => {
    // Storybook など出どころの決まらない場所では、安全側 (別タブ + rel) に倒す。
    expect(isExternalHref("https://yantene.net/articles/x")).toBe(true);
  });

  describe("出どころを渡したとき", () => {
    const origin = "https://yantene.net";

    /*
     * 自分のページが別タブで開き、自分の記事同士のリンクに nofollow が付いていた。
     * 検索エンジンに「この先は辿らなくてよい」と言っているのと同じだった (#318)。
     */
    it("同じ出どころなら内部", () => {
      expect(isExternalHref("https://yantene.net/articles/x", origin)).toBe(false);
    });

    it("ポートまで含めて見る", () => {
      expect(isExternalHref("https://yantene.net:8443/articles/x", origin)).toBe(true);
    });

    it("スキームが違えば外部", () => {
      // http と https が別の出どころであることが眼目
      expect(isExternalHref("http://yantene.net/articles/x", origin)).toBe(true);
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
      expect(isExternalHref("//yantene.net/articles/x", origin)).toBe(true);
    });

    it("出どころが URL として読めなければ内部と決めつけない", () => {
      expect(isExternalHref("https://yantene.net/x", "not a url")).toBe(true);
    });

    it("絶対 URL でないものは変わらず内部", () => {
      expect(isExternalHref("/articles/x", origin)).toBe(false);
    });
  });
});

describe("articleSlugOfHref", () => {
  const origin = "https://yantene.net";

  it("ルート相対の記事ページから slug を取る", () => {
    expect(articleSlugOfHref("/articles/hello-world")).toBe("hello-world");
  });

  it("節や問い合わせが付いていても、指している記事は同じ", () => {
    expect(articleSlugOfHref("/articles/hello#section")).toBe("hello");
    expect(articleSlugOfHref("/articles/hello?x=1")).toBe("hello");
    expect(articleSlugOfHref("/articles/hello/")).toBe("hello");
  });

  it("このサイトを指す絶対 URL も記事として扱う", () => {
    expect(articleSlugOfHref("https://yantene.net/articles/hello", origin)).toBe("hello");
  });

  it("出どころが分からなければ、絶対 URL は記事として扱わない", () => {
    expect(articleSlugOfHref("https://yantene.net/articles/hello")).toBeNull();
  });

  it("よそのサイトの同じ形のパスには当てない", () => {
    expect(articleSlugOfHref("https://example.com/articles/hello", origin)).toBeNull();
    expect(articleSlugOfHref("//yantene.net/articles/hello", origin)).toBeNull();
  });

  it("記事ページでないものには当てない", () => {
    expect(articleSlugOfHref("/articles")).toBeNull();
    expect(articleSlugOfHref("/articles/hello.md")).toBeNull();
    expect(articleSlugOfHref("/articles/hello/assets/a.png")).toBeNull();
    expect(articleSlugOfHref("/api/v1/articles/hello")).toBeNull();
    expect(articleSlugOfHref("/works/hello")).toBeNull();
    expect(articleSlugOfHref("/about")).toBeNull();
  });

  it("ページ内アンカーと相対パスには当てない", () => {
    expect(articleSlugOfHref("#user-content-fn-1")).toBeNull();
    expect(articleSlugOfHref("./hello")).toBeNull();
    expect(articleSlugOfHref("hello")).toBeNull();
  });

  it("http(s) でないスキームには当てない", () => {
    expect(articleSlugOfHref("mailto:a@example.com")).toBeNull();
    expect(articleSlugOfHref("javascript:alert(1)")).toBeNull();
  });
});
