import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ProfileCard } from "./profile-card";
import { sampleProfile } from "./profile-fixture";

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
    expect(photo?.getAttribute("src")).toBe(sampleProfile.avatarUrl);
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

  it("生年月日を dt-bday で持たせる", () => {
    const [bday] = marked(renderCard(), "dt-bday");

    // 機械には書かれたままの日付を渡す (人に見える字はサイト共通の書式)。
    expect(bday?.getAttribute("datetime")).toBe(sampleProfile.dateOfBirth);
    expect(bday?.textContent).toBe("1993.11.18");
  });

  it("出身地には印を付けない", () => {
    /*
     * h-card に生まれた場所を表す語が無い。近い名前 (`p-locality`) を流用すると
     * 「いま住んでいる街」として読まれるので、機械に渡すのは JSON-LD の
     * `birthPlace` だけにしてある。
     */
    const container = renderCard();

    expect(marked(container, "p-locality")).toHaveLength(0);
    expect(marked(container, "p-adr")).toHaveLength(0);
  });

  it("生年月日を書いていなければ dt-bday を置かない", () => {
    const { container } = render(<ProfileCard profile={{ ...sampleProfile, dateOfBirth: null }} />);

    expect(marked(container, "dt-bday")).toHaveLength(0);
    expect(marked(container, "h-card")).toHaveLength(1);
  });

  it("顔写真が無くても h-card は立つ", () => {
    const { container } = render(<ProfileCard profile={{ ...sampleProfile, avatarUrl: null }} />);
    expect(marked(container, "h-card")).toHaveLength(1);
    expect(marked(container, "u-photo")).toHaveLength(0);
    expect(marked(container, "p-name")[0]?.textContent).toBe(sampleProfile.name);
  });
});
