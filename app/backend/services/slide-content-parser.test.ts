import { describe, expect, it } from "vitest";
import { parseSlideContent, SlideContentError, summarizeNarration } from "./slide-content-parser";

function slideWith(frontmatter: string, body = "語り。\n"): string {
  return `---\n${frontmatter}---\n\n${body}`;
}

const REQUIRED = "title: 意味だけで書くスライド\npublishedOn: 2026-11-14\n";

describe("parseSlideContent", () => {
  it("reads the required fields", () => {
    const parsed = parseSlideContent(slideWith(REQUIRED));

    expect(parsed.title.toString()).toBe("意味だけで書くスライド");
    expect(parsed.publishedOn.toString()).toBe("2026-11-14");
    expect(parsed.event).toBeUndefined();
    expect(parsed.mdast.type).toBe("root");
  });

  /** 引用符で括った日付 (文字列) も、括らない日付 (YAML が Date にする) も同じに読む。 */
  it("reads a quoted date the same way", () => {
    const parsed = parseSlideContent(slideWith('title: 題\npublishedOn: "2026-11-14"\n'));

    expect(parsed.publishedOn.toString()).toBe("2026-11-14");
  });

  it("reads the event with all its parts", () => {
    const parsed = parseSlideContent(
      slideWith(
        `${REQUIRED}event:\n  name: "yantene.rb #1"\n  date: 2026-11-13\n  url: https://example.com/events/1\n`,
      ),
    );

    expect(parsed.event?.toJSON()).toEqual({
      name: "yantene.rb #1",
      date: "2026-11-13",
      url: "https://example.com/events/1",
    });
  });

  it("reads an event that has only a name", () => {
    const parsed = parseSlideContent(slideWith(`${REQUIRED}event:\n  name: 社内 LT\n`));

    expect(parsed.event?.toJSON()).toEqual({ name: "社内 LT", date: null, url: null });
  });

  /* 公開範囲は記事と同じ `status` (ADR 0040)。読み方も同じ関数。 */
  describe("status", () => {
    it("書かなければ published", () => {
      expect(parseSlideContent(slideWith(REQUIRED)).status).toBe("published");
    });

    it.each(["published", "unlisted", "withdrawn", "draft", "idea"] as const)(
      "%s を読む",
      (status) => {
        expect(parseSlideContent(slideWith(`${REQUIRED}status: ${status}\n`)).status).toBe(status);
      },
    );

    it("前後の空白と大文字小文字を均す", () => {
      expect(parseSlideContent(slideWith(`${REQUIRED}status: " Draft "\n`)).status).toBe("draft");
    });

    /*
     * 読めない値を既定の published に倒さない。誤って公開するほうが、誤って隠すより
     * 取り返しがつかない。
     */
    it.each([
      ["打ち間違い", "status: pubished\n"],
      ["字でない", "status: 1\n"],
      ["空の字", 'status: ""\n'],
      ["旧書式の visibility", "visibility: private\n"],
      ["visibility が public でも", "visibility: public\n"],
      ["status と visibility の両方", "status: draft\nvisibility: private\n"],
    ])("%s のときは SlideContentError", (_label, extra) => {
      expect(() => parseSlideContent(slideWith(`${REQUIRED}${extra}`))).toThrow(SlideContentError);
    });
  });

  it.each([
    ["題が無い", "publishedOn: 2026-11-14\n"],
    ["題が空", 'title: ""\npublishedOn: 2026-11-14\n'],
    ["題が字でない", "title: 42\npublishedOn: 2026-11-14\n"],
    ["出した日が無い", "title: 題\n"],
    ["出した日が日付でない", "title: 題\npublishedOn: いつか\n"],
    ["出した日が月まで", 'title: 題\npublishedOn: "2026-11"\n'],
    ["場が字", `${REQUIRED}event: yantene.rb\n`],
    ["場に名前が無い", `${REQUIRED}event:\n  date: 2026-11-13\n`],
    ["場の日付が読めない", `${REQUIRED}event:\n  name: x\n  date: 来週\n`],
    ["場の URL が相対パス", `${REQUIRED}event:\n  name: x\n  url: /events/1\n`],
    ["場の URL が javascript:", `${REQUIRED}event:\n  name: x\n  url: "javascript:alert(1)"\n`],
    ["場の URL が字でない", `${REQUIRED}event:\n  name: x\n  url: 42\n`],
  ])("%s のときは SlideContentError", (_label, frontmatter) => {
    expect(() => parseSlideContent(slideWith(frontmatter))).toThrow(SlideContentError);
  });

  /** 読めない LaTeX も、そのスライドだけのコンテンツ不正として扱う。 */
  it("wraps an unreadable formula", () => {
    expect(() => parseSlideContent(slideWith(REQUIRED, "$$\n\\frac{a}{\n$$\n"))).toThrow(
      SlideContentError,
    );
  });
});

describe("summarizeNarration", () => {
  /*
   * スライドに出る字 (箇条書き・図の alt・「間」の印・見出し) は断片で、文として
   * 読めるのは語りのほう。記事の抽出を本文まるごとに当てると、これらが混ざる。
   */
  it("uses only the narration, not what is shown on the slides", () => {
    const { mdast } = parseSlideContent(
      slideWith(
        REQUIRED,
        [
          "表紙で話すこと。",
          "",
          "## 最初のページ",
          "",
          "- 箇条書きの字",
          "",
          ". . .",
          "",
          "![図の alt](./figure.png)",
          "",
          "このページで話すこと。",
          "",
        ].join("\n"),
      ),
    );

    expect(summarizeNarration(mdast)).toBe("表紙で話すこと。 このページで話すこと。");
  });

  it("is empty when the deck has no narration", () => {
    const { mdast } = parseSlideContent(slideWith(REQUIRED, "## ページ\n\n- 項目\n"));

    expect(summarizeNarration(mdast)).toBe("");
  });

  it("cuts a long narration at 160 characters", () => {
    const { mdast } = parseSlideContent(slideWith(REQUIRED, `${"あ".repeat(300)}\n`));

    expect(summarizeNarration(mdast)).toHaveLength(160);
  });
});
