import type { PublicProfile } from "~/backend/handlers/profile/profile-view";
import { describe, expect, it } from "vitest";
import { AuthorNote } from "./author-note";
import { sampleProfile } from "./profile-fixture";
import { PROFILE_PHOTO } from "~/lib/profile-fallback";
import { WebmentionUrl } from "~/backend/domain/webmention";
import { readMention } from "~/backend/services/webmention-source-reader";
import { withI18n } from "~/frontend/lib/test-render";

const renderWithI18n = withI18n();

/*
 * 記事が「誰の記事か」を名乗るための印。**`p-author` を持つのはここだけ**で、記事の
 * 見出し (article-header) はもう持っていない。h-entry の中に 2 つ並ぶとパーサは先頭を
 * 採るので、どちらが答えるのかを 1 つに決めてある。
 */
const ORIGIN = "https://yantene.net";
const SLUG = "hello-world";
const TARGET = "https://example.com/article";

/** 記事ページと同じ入れ子で描く。`h-entry` は記事全体を包む `<main>` に付く。 */
function renderNote(profile: PublicProfile | null): HTMLElement {
  const { container } = renderWithI18n(
    <main className="h-entry">
      <h1 className="p-name">はじめての記事</h1>
      <article className="e-content">
        <p>
          本文から <a href={TARGET}>よそ</a> へリンクしている。
        </p>
      </article>
      <AuthorNote profile={profile} origin={ORIGIN} />
    </main>,
  );
  return container;
}

function marked(container: HTMLElement, className: string): readonly Element[] {
  return [...container.querySelectorAll(`:scope .${className}`)];
}

describe("AuthorNote の microformats2", () => {
  it("書き手を p-author h-card として 1 つだけ持つ", () => {
    const authors = marked(renderNote(sampleProfile), "p-author");

    expect(authors).toHaveLength(1);
    expect(authors[0].classList.contains("h-card")).toBe(true);
  });

  it("名前・サイト・顔・自己紹介を持たせる", () => {
    // 器の記事にも `p-name` (記事の題) があるので、h-card の中に絞って見る。
    const card = renderNote(sampleProfile).querySelector(".h-card");

    expect(card?.querySelector(":scope .p-name")?.textContent).toBe(sampleProfile.name);
    expect(card?.querySelector(":scope .u-photo")?.getAttribute("src")).toBe(PROFILE_PHOTO);
    expect(card?.querySelector(":scope .p-note")?.textContent).toContain("東京で Web 開発者");
  });

  it("u-url はトップを指す。見える導線が /about を指していても動かさない", () => {
    /*
     * `u-url` は「その人の URL」を答える印で、トップの代表 h-card が `/` を指している。
     * ここだけ `/about` にすると、読んだ側から見て同じ人に結びつかなくなる。
     */
    const urls = marked(renderNote(sampleProfile), "u-url");

    expect(urls).toHaveLength(1);
    expect(urls[0]?.getAttribute("href")).toBe(`${ORIGIN}/`);
  });

  it("名前と顔は /about へ連れて行く", () => {
    const card = renderNote(sampleProfile).querySelector(".h-card");

    expect(card?.querySelector(":scope .p-name")?.getAttribute("href")).toBe("/about");
    // 顔のリンクは人に渡さない (すぐ右の名前が同じ行き先を持っている)。
    const photoLink = card?.querySelector(":scope .u-photo")?.closest("a");
    expect(photoLink?.getAttribute("href")).toBe("/about");
    expect(photoLink?.getAttribute("aria-hidden")).toBe("true");
    expect(photoLink?.getAttribute("tabindex")).toBe("-1");
  });

  /** 印の一つ一つではなく、これを読む側 (相手の受け口で走るパーサ) から見て何が取れるか。 */
  it("送り先のパーサが書き手を読める", () => {
    const html = renderNote(sampleProfile).innerHTML;
    const mention = readMention(html, WebmentionUrl.create(`${ORIGIN}/articles/${SLUG}`), [
      WebmentionUrl.create(TARGET),
    ]);

    expect(mention.author.name).toBe(sampleProfile.name);
    expect(mention.author.url?.toString()).toBe(`${ORIGIN}/`);
  });
});

/*
 * 初回同期の前や `profile.md` を消した直後。**印ごと消してはいけない。**
 * 消えると Webmention の著者発見が黙って壊れ、相手のページにこちらの言及が名無しで並ぶ。
 */
describe("プロフィールがまだ無いとき", () => {
  it("sr-only の p-author h-card に倒れる", () => {
    const authors = marked(renderNote(null), "p-author");

    expect(authors).toHaveLength(1);
    expect(authors[0].classList.contains("h-card")).toBe(true);
    expect(authors[0].getAttribute("href")).toBe(`${ORIGIN}/`);
    expect(authors[0].textContent).toBe("やんてね");
  });

  /** sr-only の印は `aria-hidden` と `tabIndex={-1}` の対で置く (#287)。 */
  it("印は人に渡さない", () => {
    const [author] = marked(renderNote(null), "p-author");

    expect(author).toHaveAttribute("aria-hidden", "true");
    expect(author).toHaveAttribute("tabindex", "-1");
  });

  it("送り先のパーサからも書き手が読める", () => {
    const html = renderNote(null).innerHTML;
    const mention = readMention(html, WebmentionUrl.create(`${ORIGIN}/articles/${SLUG}`), [
      WebmentionUrl.create(TARGET),
    ]);

    expect(mention.author.name).toBe("やんてね");
  });
});
