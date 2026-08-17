import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryRouter, RouterProvider, useLocation } from "react-router";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { describe, expect, it } from "vitest";
import { MdastRenderer } from "./mdast-renderer";
import type { ElementContent, Properties } from "hast";
import type { Root as MdastRoot } from "mdast";
import { parseNoteContent } from "~/backend/services/note-content-parser";

function md(markdown: string): MdastRoot {
  return unified().use(remarkParse).use(remarkGfm).parse(markdown);
}

/*
 * 埋め込み (iframe) の検証だけは、DOM に載せず SSR した HTML の文字列を読む。
 * happy-dom は src を持つ iframe を document に繋いだ時点で読み込みにいくため、
 * DOM を経由するとテストが外部の生死に左右され、ログもスタックで埋まる。
 */
function ssr(markdown: string): string {
  return renderToStaticMarkup(<MdastRenderer node={md(markdown)} />);
}

describe("MdastRenderer", () => {
  it("renders headings with slug ids for anchor links", () => {
    const { container } = render(<MdastRenderer node={md("# Hello World")} />);
    const h1 = container.querySelector("h1");
    expect(h1?.textContent).toBe("Hello World");
    expect(h1?.id).toBe("hello-world");
  });

  it("renders paragraphs with emphasis, strong, and inline code", () => {
    const { container } = render(
      <MdastRenderer node={md("A **b** _c_ `d`")} />,
    );
    expect(container.querySelector("strong")?.textContent).toBe("b");
    expect(container.querySelector("em")?.textContent).toBe("c");
    expect(container.querySelector("code")?.textContent).toBe("d");
  });

  it("highlights fenced code blocks with hljs token classes", () => {
    const { container } = render(
      <MdastRenderer node={md("```ts\nconst x = 1;\n```")} />,
    );
    const code = container.querySelector(":scope pre code");
    expect(code?.className).toContain("hljs");
    // rehype-highlight がキーワードをトークン span に分解する。
    expect(container.querySelector(".hljs-keyword")?.textContent).toBe("const");
  });

  it("does not throw on an unknown code language and still renders the text", () => {
    const { container } = render(
      <MdastRenderer node={md("```made-up-lang\nhello\n```")} />,
    );
    expect(container.querySelector(":scope pre code")?.textContent).toContain(
      "hello",
    );
  });

  it("opens external links in a new tab with a safe rel", () => {
    const { container } = render(
      <MdastRenderer node={md("[x](https://example.com)")} />,
    );
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe("https://example.com");
    expect(a?.getAttribute("target")).toBe("_blank");
    expect(a?.getAttribute("rel")).toContain("noopener");
  });

  /*
   * RFC 3986 でスキームは大小を区別しない。`HTTPS://` は正しい書き方で、ブラウザは
   * 普通に開く。
   *
   * ここが**単体のテストでは捕まらない**のが肝。rehype-sanitize は許すスキームを
   * 大小を区別する完全一致で照合するので、揃えずに渡すと href ごと落ちる。判定側
   * (isExternalHref) をいくら直しても、そこへ届く前に消えている (#306)。
   */
  it.each(["HTTPS://example.com/", "HtTp://example.com/"])(
    "スキームが大文字でもリンクとして残す (%s)",
    (url) => {
      const { container } = render(<MdastRenderer node={md(`[x](${url})`)} />);
      const a = container.querySelector("a");

      expect(a?.getAttribute("href")).toBe(url.toLowerCase());
      expect(a?.getAttribute("target")).toBe("_blank");
      expect(a?.getAttribute("rel")).toContain("noopener");
    },
  );

  it("スキームが大文字でも画像として残す", () => {
    const { container } = render(
      <MdastRenderer node={md("![a](HTTPS://example.com/a.png)")} />,
    );

    expect(container.querySelector("img")?.getAttribute("src")).toBe(
      "https://example.com/a.png",
    );
  });

  /*
   * 参照記法 (`![alt][id]`) の画像に寸法が届くこと。
   *
   * **載っているのは参照の側。** mdast-util-to-hast の imageReference ハンドラは定義から
   * URL と alt だけを引いて img を組み、applyData を当てるのは参照の側なので、定義に
   * 載せても描画には届かない (#296)。refresh がどちらへ載せるかを変えたら、ここが落ちる。
   */
  it("参照記法の画像にも寸法が出る", () => {
    const node: MdastRoot = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            {
              type: "imageReference",
              identifier: "pic",
              label: "pic",
              referenceType: "full",
              alt: "絵",
              data: { hProperties: { width: 800, height: 450 } },
            },
          ],
        },
        {
          type: "definition",
          identifier: "pic",
          label: "pic",
          url: "/api/v1/notes/x/assets/ref.png",
        },
      ],
    };

    const { container } = render(<MdastRenderer node={node} />);
    const img = container.querySelector("img");

    expect(img?.getAttribute("src")).toBe("/api/v1/notes/x/assets/ref.png");
    expect(img?.getAttribute("width")).toBe("800");
    expect(img?.getAttribute("height")).toBe("450");
  });

  it("keeps internal links as plain same-tab anchors", () => {
    const { container } = render(
      <MdastRenderer node={md("[x](/notes/other)")} />,
    );
    const a = container.querySelector("a");
    expect(a?.getAttribute("href")).toBe("/notes/other");
    expect(a?.getAttribute("target")).toBeNull();
  });

  it("strips dangerous URL schemes (javascript:) from links", () => {
    const { container } = render(
      <MdastRenderer node={md("[x](javascript:alert(1))")} />,
    );
    const a = container.querySelector("a");
    // rehype-sanitize が危険な href を除去する (クリックしても JS が走らない)。
    expect(a?.getAttribute("href")).toBeNull();
  });

  /*
   * 自分のサイトを絶対 URL で書いたリンクが、別タブで開いて nofollow まで付いていた。
   * 自分で自分の記事同士の繋がりを検索エンジンに対して切っていた (#318)。
   */
  it("keeps same-origin absolute links in the same tab when siteOrigin is given", () => {
    const { container } = render(
      <MdastRenderer
        node={md("[x](https://yantene.net/notes/other)")}
        siteOrigin="https://yantene.net"
      />,
    );
    const a = container.querySelector("a");
    expect(a?.getAttribute("target")).toBeNull();
    expect(a?.getAttribute("rel")).toBeNull();
  });

  it("still marks other origins as external when siteOrigin is given", () => {
    const { container } = render(
      <MdastRenderer
        node={md("[x](https://example.com/page)")}
        siteOrigin="https://yantene.net"
      />,
    );
    const a = container.querySelector("a");
    expect(a?.getAttribute("target")).toBe("_blank");
    expect(a?.getAttribute("rel")).toContain("nofollow");
  });

  it("treats absolute links as external when siteOrigin is absent", () => {
    // 出どころが決まらない場所 (Storybook 等) では安全側に倒す。
    const { container } = render(
      <MdastRenderer node={md("[x](https://yantene.net/notes/other)")} />,
    );
    const a = container.querySelector("a");
    expect(a?.getAttribute("target")).toBe("_blank");
  });

  it("treats protocol-relative links as external (new tab + rel)", () => {
    const { container } = render(
      <MdastRenderer node={md("[x](//example.com/page)")} />,
    );
    const a = container.querySelector("a");
    expect(a?.getAttribute("target")).toBe("_blank");
    expect(a?.getAttribute("rel")).toContain("noopener");
  });

  it("resolves image URLs through transformImageUrl and sets lazy loading", () => {
    const { container } = render(
      <MdastRenderer
        node={md("![alt](./cover.png)")}
        transformImageUrl={(src) =>
          src.replace(/^\.\//, "/api/v1/notes/x/assets/")
        }
      />,
    );
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/api/v1/notes/x/assets/cover.png");
    expect(img?.getAttribute("alt")).toBe("alt");
    expect(img?.getAttribute("loading")).toBe("lazy");
  });

  it("renders GFM tables", () => {
    const { container } = render(
      <MdastRenderer node={md("| a | b |\n| - | - |\n| 1 | 2 |")} />,
    );
    expect(container.querySelectorAll("th")).toHaveLength(2);
    expect(container.querySelectorAll(":scope tbody td")).toHaveLength(2);
  });

  it("renders a raw YouTube iframe as a cookie-less embed", () => {
    const source = "//www.youtube.com/embed/abc123?start=9";
    const embedded = "https://www.youtube-nocookie.com/embed/abc123?start=9";
    const html = ssr(`<iframe src='${source}'></iframe>`);
    expect(html).toContain(`src="${embedded}"`);
    expect(html).toContain('loading="lazy"');
    // 枠が付かないと高さを持てず、既定の 150px に潰れる。
    expect(html).toContain('<div class="note-embed">');
  });

  it("drops iframes aimed at hosts outside the allow list", () => {
    const html = ssr("<iframe src='https://evil.example/embed/x'></iframe>");
    expect(html).not.toContain("iframe");
    expect(html).not.toContain("evil.example");
  });

  it("rebuilds embed attributes instead of trusting the ones in the source", () => {
    // React は属性名をそのままの綴りで出す (HTML 側が大小を区別しないため)。
    // 綴りではなく中身を見たいので、比較は小文字に倒してから行う。
    const html = ssr(
      "<iframe src='https://www.youtube.com/embed/abc123' sandbox='allow-same-origin' referrerpolicy='unsafe-url'></iframe>",
    ).toLowerCase();
    expect(html).not.toContain("sandbox");
    expect(html).toContain('referrerpolicy="strict-origin-when-cross-origin"');
  });

  it("still discards raw HTML that is not an embed", () => {
    const html = ssr(
      "<blockquote class='twitter-tweet'><p>tweet</p></blockquote>",
    );
    expect(html).not.toContain("blockquote");
    expect(html).not.toContain("tweet");
  });
});

/*
 * 脚注が注へ飛べるために要ることが 2 つある (#268)。
 *
 * 1. リンクの行き先が実在すること。id は toHast と sanitize が別々に前置を足すため、
 *    両方が当てると id にだけ二重に乗り、href が取り残される
 * 2. Router を通ること。素の `<a href="#...">` は ScrollRestoration がブラウザの
 *    ハッシュジャンプを打ち消すのでスクロールしない (目次が Link を使うのと同じ理由)
 *
 * id と href を直に比べず「指した先が在るか」で書くのは、前置の綴りが変わっても
 * 壊れないようにするため。
 */
describe("MdastRenderer: ページ内アンカー", () => {
  const withFootnote = "本文[^1]\n\n[^1]: 注の中身\n";

  /** 記事ページと同じ位置。Link が href をここからの絶対パスに直すので、素の "/" だと粗い。 */
  const notePath = "/notes/foo";

  /** 脚注つきの本文を Router の中で描く。ページ内アンカーは Link になるため要る。 */
  function renderWithFootnote(element?: React.JSX.Element): HTMLElement {
    const router = createMemoryRouter(
      [
        {
          path: "/notes/:slug",
          element: element ?? <MdastRenderer node={md(withFootnote)} />,
        },
      ],
      { initialEntries: [notePath] },
    );
    return render(<RouterProvider router={router} />).container;
  }

  /** ページ内アンカーとその行き先の id。Link は "#x" を "/notes/foo#x" に直す。 */
  function inPageAnchors(container: HTMLElement): readonly HTMLAnchorElement[] {
    return [...container.querySelectorAll("a")].filter((anchor) =>
      (anchor.getAttribute("href") ?? "").includes("#"),
    );
  }

  it("keeps every in-page anchor pointing at an element that exists", () => {
    const container = renderWithFootnote();

    const anchors = inPageAnchors(container);
    // 脚注番号と戻り矢印の 2 本。0 本だと「リンクが無いので全部通った」になる。
    expect(anchors).toHaveLength(2);

    // 落ちたときに「どの行き先が無いか」が出るよう、まとめてから比べる。
    const dangling = anchors
      .map(
        (anchor) => (anchor.getAttribute("href") ?? "").split("#", 2)[1] ?? "",
      )
      .filter(
        (id) => container.querySelector(`[id="${CSS.escape(id)}"]`) === null,
      );
    expect(dangling).toEqual([]);
  });

  it("keeps in-page anchors on the note's own path", () => {
    // "#x" が "/#x" に解決されると、注へ飛ぶかわりにトップへ飛ぶ。
    const container = renderWithFootnote();

    const strayed = inPageAnchors(container)
      .map((anchor) => anchor.getAttribute("href") ?? "")
      .filter((href) => !href.startsWith(`${notePath}#`));
    expect(strayed).toEqual([]);
  });

  it("points aria-describedby at an element that exists", () => {
    const container = renderWithFootnote();

    const described = container.querySelector("[aria-describedby]");
    const id = described?.getAttribute("aria-describedby") ?? "";
    expect(id).not.toBe("");
    expect(container.querySelector(`[id="${CSS.escape(id)}"]`)).not.toBeNull();
  });

  it("still prefixes footnote ids so they cannot clobber the DOM", () => {
    const container = renderWithFootnote();

    const ids = [...container.querySelectorAll("[id]")].map((el) => el.id);
    const footnoteIds = ids.filter((id) => /fn(ref)?-/.test(id));
    expect(footnoteIds).not.toHaveLength(0);
    expect(footnoteIds.filter((id) => !id.startsWith("user-content-"))).toEqual(
      [],
    );
    // 二重に乗っていないこと。
    expect(
      footnoteIds.filter((id) => id.startsWith("user-content-user-content-")),
    ).toEqual([]);
  });

  it("routes an in-page anchor through the router instead of a bare hash jump", async () => {
    // Router が見ている hash を画面に出して、遷移が Router を通ったかを読む。
    // 素の <a> だとメモリ履歴は動かないので、ここが空のままになる。
    function Probe(): React.JSX.Element {
      return (
        <>
          <MdastRenderer node={md(withFootnote)} />
          <output>{useLocation().hash}</output>
        </>
      );
    }
    const container = renderWithFootnote(<Probe />);
    expect(container.querySelector("output")?.textContent).toBe("");

    const reference = container.querySelector<HTMLAnchorElement>(
      'a[data-footnote-ref="true"]',
    );
    if (reference === null) throw new Error("脚注のリンクが描かれていない");
    await userEvent.click(reference);

    const href = reference.getAttribute("href") ?? "";
    expect(container.querySelector("output")?.textContent).toBe(
      href.slice(href.indexOf("#")),
    );
  });

  it("leaves links that are not in-page anchors as plain anchors", () => {
    // Router の外でも描けること。ページ内アンカーだけを Link に通す狙いの裏返し。
    const { container } = render(
      <MdastRenderer node={md("[x](/notes/other) [y](https://example.com)")} />,
    );
    expect(container.querySelectorAll("a")).toHaveLength(2);
  });
});

/*
 * 数式は refresh 時に MathML へ組み、MDAST の data (hChildren) に埋めてある
 * (ADR 0013)。ここで確かめるのは、その木が sanitize を越えて `<math>` として出ること。
 */
describe("MdastRenderer: MathML", () => {
  /** refresh が埋める形の数式ノードを組む。 */
  function mathNode(
    children: readonly ElementContent[],
    properties: Properties = {},
  ): MdastRoot {
    return {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            { type: "text", value: "式 " },
            {
              type: "inlineMath",
              value: "a^2",
              data: {
                hName: "math",
                hProperties: {
                  xmlns: "http://www.w3.org/1998/Math/MathML",
                  ...properties,
                },
                hChildren: [...children],
              },
            },
          ],
        },
      ],
    };
  }

  const element = (
    tagName: string,
    properties: Properties,
    children: readonly ElementContent[],
  ): ElementContent => ({
    type: "element",
    tagName,
    properties,
    children: [...children],
  });

  const superscript = [
    element("mrow", {}, [
      element("msup", {}, [
        element("mi", {}, [{ type: "text", value: "a" }]),
        element("mn", {}, [{ type: "text", value: "2" }]),
      ]),
    ]),
  ];

  it("renders the embedded MathML as a <math> element", () => {
    const { container } = render(
      <MdastRenderer node={mathNode(superscript)} />,
    );
    const math = container.querySelector("math");
    expect(math).not.toBeNull();
    expect(math?.querySelector(":scope msup mi")?.textContent).toBe("a");
    expect(math?.getAttribute("xmlns")).toBe(
      "http://www.w3.org/1998/Math/MathML",
    );
  });

  it("keeps the typesetting attributes the allow list names", () => {
    const html = renderToStaticMarkup(
      <MdastRenderer
        node={mathNode(
          [
            element("mtable", { columnalign: "center", rowspacing: "0.16em" }, [
              element("mtr", {}, [
                element("mtd", {}, [
                  element("mo", { stretchy: "false", fence: "true" }, [
                    { type: "text", value: "(" },
                  ]),
                ]),
              ]),
            ]),
          ],
          { display: "block" },
        )}
      />,
    );
    expect(html).toContain('display="block"');
    expect(html).toContain('columnalign="center"');
    expect(html).toContain('rowspacing="0.16em"');
    expect(html).toContain('stretchy="false"');
  });

  /*
   * allowlist に無いものは落ちる。
   *
   * `style` は MathML の要素にだけ通す (ADR 0019)。Temml が桁や数式番号の位置を
   * inline style で渡してくるため。**通すのはここだけで、本文の段落や見出しには
   * 入らない** (そちらは rehype-sanitize の既定が落とす)。URL・スクリプトを運べる
   * ものは MathML でも通さない。
   */
  it("strips attributes and elements outside the MathML allow list", () => {
    const html = renderToStaticMarkup(
      <MdastRenderer
        node={mathNode([
          element(
            "mi",
            {
              style: "position:absolute",
              className: ["katex"],
              onClick: "alert(1)",
              href: "javascript:alert(1)",
            },
            [{ type: "text", value: "a" }],
          ),
          element("mglyph", { src: "https://evil.example/pixel.png" }, []),
          element("script", {}, [{ type: "text", value: "alert(1)" }]),
        ])}
      />,
    );
    expect(html).toContain(">a</mi>");
    // style は通す (上記)。class・イベント・URL は落とす。
    expect(html).not.toContain("katex");
    expect(html).not.toContain("onclick");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("mglyph");
    expect(html).not.toContain("evil.example");
    expect(html).not.toContain("<script");
  });

  /*
   * MathML の要素は `<math>` の中でしか意味を持たない。埋め込みと同じ生 HTML に
   * 紛れ込ませると sanitize まで届く (埋め込みがある記事だけ raw を展開するため) ので、
   * ancestors で `<math>` の中に限る。sanitize は要素を剥がして中身を残す作りなので、
   * 見るのはタグが出ないことまで。
   */
  it("drops MathML elements that appear outside <math>", () => {
    const embed = "<iframe src='https://www.youtube.com/embed/abc123'>";
    const html = ssr(`<div><mi>loose</mi>${embed}</iframe></div>`);
    expect(html).toContain("youtube-nocookie.com/embed/abc123");
    expect(html).not.toContain("<mi");
  });

  /*
   * 埋め込みのある記事では、生 HTML を要素に組み直すためにツリー全体を HTML へ直して
   * 読み直す (expandRawHtml)。数式もその往復を通るので、MathML が別の名前空間で
   * 読み直されて崩れないことを見る。
   */
  it("survives the raw HTML round trip that embeds trigger", () => {
    const node = mathNode(superscript);
    const embed: MdastRoot = {
      type: "root",
      children: [
        {
          type: "html",
          value: "<iframe src='https://www.youtube.com/embed/abc123'></iframe>",
        },
        ...node.children,
      ],
    };

    const html = renderToStaticMarkup(<MdastRenderer node={embed} />);
    expect(html).toContain("youtube-nocookie.com/embed/abc123");
    expect(html).toContain("<math");
    expect(html).toContain("<msup>");
    expect(html).toContain("<mi>a</mi>");
  });
});

/*
 * Alert は refresh 時のパースが引用から起こす (note-content-parser.ts)。
 * md() は素の remark なので data が付かない。実際の経路に合わせてパーサを通す。
 */
function note(markdown: string): MdastRoot {
  return parseNoteContent(`---\ntitle: T\n---\n\n${markdown}`).mdast;
}

describe("GFM alerts", () => {
  it("種別に応じた見出しとアイコンを添えて描く", () => {
    const { container } = render(
      <MdastRenderer node={note("> [!WARNING]\n> リンク先は消えました。\n")} />,
    );

    const alert = container.querySelector(".markdown-alert");
    expect(alert?.className).toContain("markdown-alert-warning");
    expect(
      alert?.querySelector(".markdown-alert-title")?.textContent,
    ).toContain("注意");
    expect(alert?.querySelector("svg")).not.toBeNull();
    expect(alert?.textContent).toContain("リンク先は消えました。");
  });

  it("ラベル行を本文として描かない", () => {
    const { container } = render(
      <MdastRenderer node={note("> [!NOTE]\n> 補足。\n")} />,
    );
    expect(container.textContent).not.toContain("[!NOTE]");
  });

  it("Alert でない引用は blockquote のまま描く", () => {
    const { container } = render(
      <MdastRenderer node={note("> ただの引用。\n")} />,
    );
    expect(container.querySelector("blockquote")?.textContent).toContain(
      "ただの引用。",
    );
    expect(container.querySelector(".markdown-alert")).toBeNull();
  });

  it("Alert の中のリンクや強調を保つ", () => {
    const { container } = render(
      <MdastRenderer
        node={note(
          "> [!CAUTION]\n> **危険**な [リンク](https://example.com)。\n",
        )}
      />,
    );

    const alert = container.querySelector(".markdown-alert-caution");
    expect(alert?.querySelector("strong")?.textContent).toBe("危険");
    expect(alert?.querySelector("a")?.getAttribute("href")).toBe(
      "https://example.com",
    );
  });

  it("sanitize が Alert の要素と種別を落とさない", () => {
    const html = renderToStaticMarkup(
      <MdastRenderer node={note("> [!TIP]\n> 助言。\n")} />,
    );
    expect(html).toContain("markdown-alert-tip");
    expect(html).toContain("ヒント");
  });
});

/*
 * 曲は refresh 前に Opus へ焼き、本文には生の `<audio>` で書く (ADR 0022)。
 * 通してよいのは自分のアセット API を指す音源だけで、そこは toAudio が絞る。
 *
 * 埋め込みと同じ理由で、DOM に載せず SSR した文字列を読む。
 */
describe("MdastRenderer: audio", () => {
  const ASSET = "/api/v1/notes/a-song-about-your-eyebrows/assets/song.opus";

  it("自分のアセットを指す音源を再生バーとして残す", () => {
    const html = ssr(
      `<audio controls preload="none">\n<source src="${ASSET}" type="audio/ogg">\n</audio>`,
    );
    expect(html).toContain("<audio");
    expect(html).toContain(`src="${ASSET}"`);
    expect(html).toContain('type="audio/ogg"');
    expect(html).toContain("controls");
  });

  it("自分のアセット以外を指す音源は、audio ごと落とす", () => {
    const html = ssr(
      '<audio controls>\n<source src="https://example.com/song.opus" type="audio/ogg">\n</audio>',
    );
    expect(html).not.toContain("<audio");
    expect(html).not.toContain("example.com");
  });

  it("解決されていない相対パスは通さない", () => {
    const html = ssr(
      '<audio controls>\n<source src="./song.opus" type="audio/ogg">\n</audio>',
    );
    expect(html).not.toContain("<audio");
  });

  it("autoplay と loop は引き継がない", () => {
    const html = ssr(
      `<audio controls autoplay loop>\n<source src="${ASSET}" type="audio/ogg">\n</audio>`,
    );
    expect(html).toContain("<audio");
    expect(html).not.toContain("autoplay");
    expect(html).not.toContain("loop");
  });

  it("通せる音源が 1 つも無ければ audio ごと消える", () => {
    const html = ssr("<audio controls>\n</audio>");
    expect(html).not.toContain("<audio");
  });
});
