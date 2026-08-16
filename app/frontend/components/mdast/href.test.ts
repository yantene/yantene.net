import { describe, expect, it } from "vitest";
import { isExternalHref } from "./href";

describe("isExternalHref", () => {
  // eslint-disable-next-line unicorn/prefer-https -- http と https の両方を外部として扱うことが眼目
  it.each(["http://example.com/", "https://example.com/"])(
    "http(s) は外部 (%s)",
    (href) => {
      expect(isExternalHref(href)).toBe(true);
    },
  );

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

  /*
   * 自分のサイトを絶対 URL で書いたリンクも「外部」になる。見ているのは絶対 URL か
   * どうかで、出どころではない (#318)。
   */
  it("自分のサイトでも絶対 URL なら外部として扱う", () => {
    expect(isExternalHref("https://yantene.net/notes/x")).toBe(true);
  });
});
