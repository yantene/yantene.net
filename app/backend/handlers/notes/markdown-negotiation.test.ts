import { describe, expect, it } from "vitest";
import { isMarkdownPreferred } from "./markdown-negotiation";

/** Chrome が実際に送る Accept。この機能で最も守りたい入力。 */
const CHROME_ACCEPT =
  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7";

/** Firefox / Safari が送る Accept。 */
const FIREFOX_ACCEPT = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";

/*
 * ワイルドカードを Markdown 側に数えると全訪問者に原文が配られる。ここが落ちる変更は
 * 読者の目に見える壊れ方をするので、真っ先に守る。
 */
describe("isMarkdownPreferred: ブラウザと汎用クライアントは必ず HTML", () => {
  it.each([
    ["ヘッダー無し", undefined],
    ["空文字列", ""],
    ["curl の既定", "*/*"],
    ["Chrome", CHROME_ACCEPT],
    ["Firefox / Safari", FIREFOX_ACCEPT],
    ["型だけのワイルドカード", "text/*"],
    ["text/plain", "text/plain"],
    ["別名は採らない (text/x-markdown)", "text/x-markdown"],
    ["application/json", "application/json"],
  ])("%s は Markdown を要求していないと見る", (_label, accept) => {
    expect(isMarkdownPreferred(accept)).toBe(false);
  });
});

describe("isMarkdownPreferred: 名指しされたときだけ Markdown", () => {
  it.each([
    ["単独", "text/markdown"],
    ["ワイルドカードを従えている", "text/markdown, */*;q=0.8"],
    ["HTML より上に置かれている", "text/markdown, text/html;q=0.9"],
    ["q でも HTML を上回る", "text/markdown;q=0.9, text/html;q=0.8"],
    ["完全一致が text/* に勝つ", "text/*;q=0.9, text/markdown"],
    ["HTML を明示的に拒んでいる", "text/html;q=0, text/markdown"],
  ])("%s なら Markdown を返す", (_label, accept) => {
    expect(isMarkdownPreferred(accept)).toBe(true);
  });
});

/*
 * 同点は HTML に倒す。ワイルドカードと同じで「どちらでもよい」の意思表示だから、
 * 既定の表現を選ぶ。
 */
describe("isMarkdownPreferred: 同点・逆順は HTML", () => {
  it.each([
    ["同点", "text/markdown, text/html"],
    ["HTML のほうが上", "text/html, text/markdown;q=0.9"],
    ["Markdown を明示的に拒んでいる", "text/markdown;q=0"],
    ["重複は先勝ち", "text/markdown;q=0, text/markdown"],
  ])("%s なら HTML を返す", (_label, accept) => {
    expect(isMarkdownPreferred(accept)).toBe(false);
  });
});

describe("isMarkdownPreferred: パースの頑健さ", () => {
  it.each([
    ["大文字小文字を無視する", "TEXT/MARKDOWN"],
    ["パラメータを無視する", "text/markdown; charset=utf-8"],
    ["空白を無視する", "  text/markdown ; q=1.0  "],
    ["読めない q は 1 とみなす", "text/markdown;q=abc"],
    ["値なしの q も 1 とみなす", "text/markdown;q="],
    ["1 を超える q は 1 に丸める", "text/markdown;q=2"],
    ["壊れた媒体範囲は捨てる", "garbage, text/, /markdown, text/markdown"],
  ])("%s", (_label, accept) => {
    expect(isMarkdownPreferred(accept)).toBe(true);
  });

  it("負の q は 0 に丸める", () => {
    expect(isMarkdownPreferred("text/markdown;q=-1")).toBe(false);
  });

  it("壊れた媒体範囲しか無ければ HTML", () => {
    expect(isMarkdownPreferred("garbage, text/, /markdown")).toBe(false);
  });
});
