import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProfileCard } from "./profile-card";
import { sampleProfile } from "./profile-fixture";
import { PROFILE_PHOTO } from "~/lib/profile-fallback";

/*
 * `/about` の h-card。壊れても画面には何も出ないので、ここで形を固定する。
 *
 * **代表 h-card はトップのヒーローのまま** (hero-section.mf2.test.tsx)。こちらは
 * 同じ人を指す別の h-card で、`u-url` がトップを指すことでそれが分かる。
 */
function renderCard(): HTMLElement {
  const { container } = render(<ProfileCard profile={sampleProfile} />);
  return container;
}

/** 印は数まで見る。2 つあるのは無いのと同じくらい困る (パーサは先頭を採る)。 */
function marked(container: HTMLElement, className: string): Element[] {
  return [...container.querySelectorAll(`:scope .${className}`)];
}

describe("ProfileCard の microformats2", () => {
  it("h-card を 1 つ置く", () => {
    expect(marked(renderCard(), "h-card")).toHaveLength(1);
  });

  it("名前・自己紹介・顔・サイトを持たせる", () => {
    const container = renderCard();

    const [name] = marked(container, "p-name");
    expect(name?.textContent).toBe(sampleProfile.name);

    const [note] = marked(container, "p-note");
    expect(note?.textContent).toContain("東京で Web 開発者をやっています。");

    const [photo] = marked(container, "u-photo");
    expect(photo?.getAttribute("src")).toBe(PROFILE_PHOTO);
    // すぐ隣に同じことを言う名前があるので、読み上げで 2 回名乗らせない。
    expect(photo?.getAttribute("alt")).toBe("");

    const [url] = marked(container, "u-url");
    expect(url?.getAttribute("href")).toBe("/");
  });

  it("相互リンクのある先にだけ rel=me を付ける", () => {
    const me = [...renderCard().querySelectorAll(':scope a[rel~="me"]')].map((link) =>
      link.getAttribute("href"),
    );
    expect(me).toEqual(
      sampleProfile.socials.filter((social) => social.isMe).map((social) => social.url),
    );
  });

  /** sr-only の印は `aria-hidden` と `tabIndex={-1}` の対で置く (#287)。 */
  it("mf2 の印は人に渡さない", () => {
    const [url] = marked(renderCard(), "u-url");
    expect(url?.getAttribute("aria-hidden")).toBe("true");
    expect(url?.getAttribute("tabindex")).toBe("-1");
  });

  it("顔はサイトのアイコン 1 つで、プロフィールでは選べない", () => {
    /*
     * 顔がサイトのアイコンに決まっているなら、コンテンツリポジトリに書ける欄を設けても
     * 選択肢は増えない。増えるのは「書き忘れて顔の無いプロフィール」という状態だけ。
     */
    expect(marked(renderCard(), "u-photo")[0]?.getAttribute("src")).toBe(PROFILE_PHOTO);
  });
});
