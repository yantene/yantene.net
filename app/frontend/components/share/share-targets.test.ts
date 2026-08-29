import { describe, expect, it } from "vitest";
import { buildClipboardPayload, buildShareTargets } from "./share-targets";

const url = "https://yantene.net/notes/hacku-2016";

/*
 * 出来上がった URL は、素の文字列ではなくパースして確かめる。組み立てと同じ手順を期待値に
 * 書き写すと、エンコードを間違えたときに期待値も一緒に間違えるため。
 */
function composeUrlOf(
  targets: readonly { readonly key: string; readonly href: string }[],
  key: string,
): URL {
  return new URL(targets.find((target) => target.key === key)?.href ?? "");
}

describe("buildShareTargets", () => {
  it("puts the url and the title into each service's compose screen", () => {
    const targets = buildShareTargets(url, "記事の題");

    const x = composeUrlOf(targets, "x");
    expect(`${x.origin}${x.pathname}`).toBe("https://x.com/intent/post");
    expect(x.searchParams.get("url")).toBe(url);
    expect(x.searchParams.get("text")).toBe("記事の題");

    // Bluesky は url を別に受け取らないので、本文に混ぜて渡す。
    const bluesky = composeUrlOf(targets, "bluesky");
    expect(`${bluesky.origin}${bluesky.pathname}`).toBe("https://bsky.app/intent/compose");
    expect(bluesky.searchParams.get("text")).toBe(`記事の題 ${url}`);

    const facebook = composeUrlOf(targets, "facebook");
    expect(`${facebook.origin}${facebook.pathname}`).toBe(
      "https://www.facebook.com/sharer/sharer.php",
    );
    expect(facebook.searchParams.get("u")).toBe(url);
  });

  it("escapes characters that would otherwise break out of the query", () => {
    const targets = buildShareTargets(url, 'a&b=c "d"');

    // & や = をそのまま置くと、ここで別のパラメータに割れてしまう。
    expect(composeUrlOf(targets, "x").searchParams.get("text")).toBe('a&b=c "d"');
  });
});

describe("buildClipboardPayload", () => {
  it("carries a rich link and a markdown link", () => {
    expect(buildClipboardPayload(url, "記事の題")).toEqual({
      html: `<a href="${url}">記事の題</a>`,
      plain: `[記事の題](${url})`,
    });
  });

  /*
   * 題は人が書くので、貼り先のマークアップとして解釈される字が普通に混ざる。html 側で
   * タグが生えたり、Markdown 側でリンクが途中で切れたりしないこと。
   */
  it("keeps a title with markup characters from breaking either form", () => {
    const payload = buildClipboardPayload(url, '<script>& [注] "引用"');

    expect(payload.html).toBe(`<a href="${url}">&lt;script&gt;&amp; [注] &quot;引用&quot;</a>`);
    expect(payload.plain).toBe(String.raw`[<script>& \[注\] "引用"](${url})`);
  });
});
