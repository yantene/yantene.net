import { describe, expect, it } from "vitest";
import { decodeHtmlEntities, parseOgp } from "./parse-ogp";

describe("decodeHtmlEntities", () => {
  it("名前付き実体を戻す", () => {
    expect(decodeHtmlEntities("a &amp; b &lt;c&gt; &quot;d&quot;")).toBe('a & b <c> "d"');
  });

  it("数値文字参照を戻す (10 進・16 進)", () => {
    expect(decodeHtmlEntities("&#39;&#x3042;")).toBe("'あ");
  });

  it("知らない実体はそのまま残す", () => {
    expect(decodeHtmlEntities("&unknownentity;")).toBe("&unknownentity;");
  });
});

describe("parseOgp", () => {
  it("og:* を読む", () => {
    const ogp = parseOgp(`
      <html><head>
        <meta property="og:title" content="記事の題">
        <meta property="og:description" content="説明">
        <meta property="og:site_name" content="サイト名">
        <meta property="og:image" content="https://example.com/og.png">
      </head></html>
    `);
    expect(ogp).toEqual({
      title: "記事の題",
      description: "説明",
      siteName: "サイト名",
      imageUrl: "https://example.com/og.png",
      faviconUrl: undefined,
    });
  });

  it("og:title が無ければ <title> で代える", () => {
    const ogp = parseOgp("<html><head><title>題だけ</title></head></html>");
    expect(ogp.title).toBe("題だけ");
  });

  it("og:description が無ければ meta name=description で代える", () => {
    const ogp = parseOgp(`
      <meta name="description" content="素の説明">
      <title>題</title>
    `);
    expect(ogp.description).toBe("素の説明");
  });

  it("属性の並び順・引用符の種類に依らず読む", () => {
    const ogp = parseOgp(
      `<meta content='一重引用' property=og:title><meta content="裸" property=og:site_name>`,
    );
    expect(ogp.title).toBe("一重引用");
    expect(ogp.siteName).toBe("裸");
  });

  it("実体参照を戻す", () => {
    const ogp = parseOgp(`<meta property="og:title" content="Q&amp;A &quot;入門&quot;">`);
    expect(ogp.title).toBe('Q&A "入門"');
  });

  it("rel=icon の href を favicon にする", () => {
    const ogp = parseOgp(`<link rel="icon" href="/icon.png"><title>題</title>`);
    expect(ogp.faviconUrl).toBe("/icon.png");
  });

  it('rel="shortcut icon" も favicon として拾う', () => {
    const ogp = parseOgp(`<link rel="shortcut icon" href="/favicon.ico"><title>題</title>`);
    expect(ogp.faviconUrl).toBe("/favicon.ico");
  });

  it("icon が複数あれば先に出たものを採る", () => {
    const ogp = parseOgp(`
      <link rel="icon" href="/first.png">
      <link rel="icon" href="/second.png">
      <title>題</title>
    `);
    expect(ogp.faviconUrl).toBe("/first.png");
  });

  it("rel=stylesheet は favicon にしない", () => {
    const ogp = parseOgp(`<link rel="stylesheet" href="/style.css"><title>題</title>`);
    expect(ogp.faviconUrl).toBeUndefined();
  });

  it("何も無ければ全て undefined", () => {
    const ogp = parseOgp("<html><body>本文だけ</body></html>");
    expect(ogp.title).toBeUndefined();
    expect(ogp.imageUrl).toBeUndefined();
  });

  it("空文字の content は無かったことにする", () => {
    const ogp = parseOgp(`<meta property="og:title" content="   "><title>題</title>`);
    expect(ogp.title).toBe("題");
  });
});
