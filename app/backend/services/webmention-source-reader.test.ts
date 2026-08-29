import { describe, expect, it } from "vitest";
import { hasLinkToTarget, readMention } from "./webmention-source-reader";
import { WebmentionUrl } from "~/backend/domain/webmention";

const SOURCE = WebmentionUrl.create("https://example.com/post/1");
const TARGET = WebmentionUrl.create("https://yantene.net/notes/hello");

function hasLink(html: string): boolean {
  return hasLinkToTarget(html, SOURCE, TARGET);
}

describe("hasLinkToTarget", () => {
  it("素のリンクを見つける", () => {
    expect(hasLink('<a href="https://yantene.net/notes/hello">x</a>')).toBe(true);
  });

  it("引用符なしの属性も読む", () => {
    expect(hasLink("<a href=https://yantene.net/notes/hello>x</a>")).toBe(true);
  });

  it("素片やクエリが付いていても同じ資源として数える", () => {
    expect(hasLink('<a href="https://yantene.net/notes/hello?ref=x#top">x</a>')).toBe(true);
  });

  it("相対リンクは source の URL を基準に解決する", () => {
    // source が別のサイトなので、相対リンクがこちらを指すことはない。
    expect(hasLink('<a href="/notes/hello">x</a>')).toBe(false);
  });

  it("img の src も数える", () => {
    expect(hasLink('<img src="https://yantene.net/notes/hello" alt="">')).toBe(true);
  });

  it("属性の中の `&amp;` を戻してから解決する", () => {
    expect(hasLink('<a href="https://yantene.net/notes/hello?a=1&amp;b=2">x</a>')).toBe(true);
  });

  /*
   * ここが検証の肝。本文に URL の字面を書いただけの相手を「リンクしている」と
   * 読んでしまうと、誰でも好きな記事に行を作れてしまう。
   */
  it("本文に書かれただけの URL は数えない", () => {
    expect(hasLink("<p>https://yantene.net/notes/hello は良い記事だ</p>")).toBe(false);
  });

  it("別の記事へのリンクは数えない", () => {
    expect(hasLink('<a href="https://yantene.net/notes/other">x</a>')).toBe(false);
  });

  it("リンクが一つも無ければ false", () => {
    expect(hasLink("<p>ただの文章</p>")).toBe(false);
  });
});

describe("readMention", () => {
  function read(html: string): ReturnType<typeof readMention> {
    return readMention(html, SOURCE, TARGET);
  }

  it("u-in-reply-to は返信として読む", () => {
    const parsed = read(`
      <div class="h-entry">
        <a class="u-in-reply-to" href="https://yantene.net/notes/hello">re</a>
        <div class="e-content"><p>いい記事だった</p></div>
      </div>`);

    expect(parsed.type.toString()).toBe("reply");
    expect(parsed.content?.toString()).toBe("いい記事だった");
  });

  it("u-like-of はいいねとして読む", () => {
    const parsed = read(`
      <div class="h-entry">
        <a class="u-like-of" href="https://yantene.net/notes/hello">like</a>
      </div>`);

    expect(parsed.type.toString()).toBe("like");
    /*
     * 本文は持たない。mf2 が推測した名前 (リンクの文字列) を本文に流用すると、
     * 送り手が書いていない言葉が画面に並ぶ。
     */
    expect(parsed.content).toBeUndefined();
  });

  it("u-repost-of はリポストとして読む", () => {
    const parsed = read(`
      <div class="h-entry">
        <a class="u-repost-of" href="https://yantene.net/notes/hello">rt</a>
      </div>`);

    expect(parsed.type.toString()).toBe("repost");
  });

  /* 別の記事への返信のついでにこちらへリンクしただけなら、ただの言及。 */
  it("target を名指ししていなければ言及として読む", () => {
    const parsed = read(`
      <div class="h-entry">
        <a class="u-in-reply-to" href="https://example.org/other">re</a>
        <div class="e-content">
          <p>参考: <a href="https://yantene.net/notes/hello">これ</a></p>
        </div>
      </div>`);

    expect(parsed.type.toString()).toBe("mention");
  });

  it("mf2 が無いページも言及として読める", () => {
    const parsed = read('<p><a href="https://yantene.net/notes/hello">x</a></p>');

    expect(parsed.type.toString()).toBe("mention");
    expect(parsed.author.name).toBeUndefined();
  });

  it("h-card から著者を読む", () => {
    const parsed = read(`
      <div class="h-entry">
        <div class="p-author h-card">
          <a class="u-url" href="/about">
            <img class="u-photo" src="/me.png" alt="">
            <span class="p-name">Alice</span>
          </a>
        </div>
        <a class="u-in-reply-to" href="https://yantene.net/notes/hello">re</a>
      </div>`);

    expect(parsed.author.name).toBe("Alice");
    expect(parsed.author.url?.toString()).toBe("https://example.com/about");
    expect(parsed.author.photo?.toString()).toBe("https://example.com/me.png");
  });

  /* h-entry に著者が無いページは珍しくない。ページを代表する h-card で補う。 */
  it("h-entry に著者が無ければページの h-card で補う", () => {
    const parsed = read(`
      <div class="h-card"><a class="p-name u-url" href="/">Bob</a></div>
      <div class="h-entry">
        <a class="u-in-reply-to" href="https://yantene.net/notes/hello">re</a>
      </div>`);

    expect(parsed.author.name).toBe("Bob");
  });

  it("dt-published を時刻として読む", () => {
    const parsed = read(`
      <div class="h-entry">
        <a class="u-in-reply-to" href="https://yantene.net/notes/hello">re</a>
        <time class="dt-published" datetime="2026-08-01T10:00:00+09:00">x</time>
      </div>`);

    expect(parsed.publishedAt?.toString()).toBe("2026-08-01T01:00:00Z");
  });

  it("日付だけの dt-published はその日の始まり (UTC) にする", () => {
    const parsed = read(`
      <div class="h-entry">
        <a class="u-in-reply-to" href="https://yantene.net/notes/hello">re</a>
        <time class="dt-published" datetime="2026-08-01">x</time>
      </div>`);

    expect(parsed.publishedAt?.toString()).toBe("2026-08-01T00:00:00Z");
  });

  it("読めない dt-published は欠かす", () => {
    const parsed = read(`
      <div class="h-entry">
        <a class="u-in-reply-to" href="https://yantene.net/notes/hello">re</a>
        <time class="dt-published" datetime="いつか">x</time>
      </div>`);

    expect(parsed.publishedAt).toBeUndefined();
  });

  it("e-content が無ければ p-summary で代える", () => {
    const parsed = read(`
      <div class="h-entry">
        <a class="u-like-of" href="https://yantene.net/notes/hello">like</a>
        <p class="p-summary">要約だけある</p>
      </div>`);

    expect(parsed.content?.toString()).toBe("要約だけある");
  });

  /*
   * 索引ページのように h-entry が並ぶ相手で、どれとも結び付かないときは選ばない。
   * 先頭を拾うと、target とは無関係な記事の著者と本文を保存してしまう。
   */
  it("どの h-entry とも結び付かなければ、中身を読まない", () => {
    const parsed = read(`
      <div class="h-entry">
        <div class="p-author h-card"><span class="p-name">Alice</span></div>
        <div class="e-content"><p>無関係な記事 1</p></div>
      </div>
      <div class="h-entry">
        <div class="e-content"><p>無関係な記事 2</p></div>
      </div>
      <p><a href="https://yantene.net/notes/hello">脇のリンク</a></p>`);

    expect(parsed.type.toString()).toBe("mention");
    expect(parsed.content).toBeUndefined();
    expect(parsed.author.name).toBeUndefined();
  });

  /* 一覧ページのように h-entry が並ぶ相手でも、target を指すものを選ぶ。 */
  it("target を指す h-entry を選ぶ", () => {
    const parsed = read(`
      <div class="h-entry">
        <a class="u-in-reply-to" href="https://example.org/other">re</a>
        <div class="e-content"><p>無関係</p></div>
      </div>
      <div class="h-entry">
        <a class="u-in-reply-to" href="https://yantene.net/notes/hello">re</a>
        <div class="e-content"><p>こっちが本命</p></div>
      </div>`);

    expect(parsed.content?.toString()).toBe("こっちが本命");
  });
});
