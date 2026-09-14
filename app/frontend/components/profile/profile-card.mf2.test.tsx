import { describe, expect, it } from "vitest";
import { ProfileCard } from "./profile-card";
import { withI18n } from "~/frontend/lib/test-render";

const renderWithI18n = withI18n();
import type { PublicProfile } from "~/backend/handlers/profile/profile-view";

/*
 * `/about` の名乗りが持つ microformats2 の印。壊れても画面には何も出ないので、
 * ここで形を固定する (hero-section.mf2.test.tsx と同じ理由)。
 *
 * **ここの h-card は代表 h-card ではない。** 代表はトップのヒーローにあり、
 * こちらは同じ人を指す別の h-card になる。代表が 2 つあるとどちらを読むかが
 * 決まらないので、`u-url` はこのページ自身ではなく出ていく先に付けてある。
 */
const PROFILE: PublicProfile = {
  name: "吉田 周平 (Shuhei YOSHIDA)",
  dateOfBirth: "1993-11-18",
  birthplace: "愛知県刈谷市",
  tagline: "一介のコンピュータ好き。\n東京で Web 開発をしている。",
  socials: [
    { platform: "github", url: "https://github.com/yantene", isMe: true },
    { platform: "bluesky", url: "https://bsky.app/profile/yantene.net", isMe: true },
    { platform: "discord", url: "https://discord.com/users/yantene", isMe: false },
  ],
};

function renderCard(profile: PublicProfile = PROFILE): HTMLElement {
  const { container } = renderWithI18n(<ProfileCard profile={profile} />);
  return container;
}

describe("ProfileCard の microformats2", () => {
  it("h-card を 1 つだけ置く", () => {
    expect(renderCard().querySelectorAll(":scope .h-card")).toHaveLength(1);
  });

  it("名前・顔・自己紹介・生年月日を持たせる", () => {
    const card = renderCard().querySelector(":scope .h-card");

    expect(card?.querySelector(":scope .p-name")?.textContent).toBe(PROFILE.name);
    expect(card?.querySelector(":scope .u-photo")?.getAttribute("src")).toBe("/icons/icon-512.png");
    expect(card?.querySelector(":scope .p-note")?.textContent).toBe(PROFILE.tagline);
    expect(card?.querySelector(":scope .dt-bday")?.getAttribute("datetime")).toBe("1993-11-18");
  });

  it("顔は読み上げに出さない", () => {
    // 隣に名前が字で出ているので、読み上げると同じ名前が 2 回続く。
    expect(renderCard().querySelector(":scope .u-photo")?.getAttribute("alt")).toBe("");
  });

  it("自己紹介を行ごとに割らない", () => {
    /*
     * `p-note` を読むパーサに渡る字は 1 つの文字列であってほしい。行で折るのは
     * CSS の仕事なので、`<br>` も行ごとの要素も入らない。
     */
    const note = renderCard().querySelector(":scope .p-note");

    expect(note?.querySelectorAll("br")).toHaveLength(0);
    expect(note?.children).toHaveLength(0);
  });

  it("isMe を立てた先にだけ rel=me を付ける", () => {
    const me = [...renderCard().querySelectorAll(':scope a[rel~="me"]')].map((link) =>
      link.getAttribute("href"),
    );

    expect(me).toEqual(["https://github.com/yantene", "https://bsky.app/profile/yantene.net"]);
  });

  it("rel=me を付けない先にも安全な rel は残す", () => {
    const discord = renderCard().querySelector(
      ':scope a[href="https://discord.com/users/yantene"]',
    );

    expect(discord?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("出身地には印を付けない", () => {
    /*
     * h-card に生まれた場所を表す語が無い。近い名前 (`p-locality`) を流用すると
     * 「いま住んでいる街」として読まれるので、機械に渡すのは JSON-LD の
     * `birthPlace` だけにしてある。
     */
    const card = renderCard().querySelector(":scope .h-card");

    expect(card?.querySelector(":scope .p-locality")).toBeNull();
    expect(card?.querySelector(":scope .p-adr")).toBeNull();
  });
});
