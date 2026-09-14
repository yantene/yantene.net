import type { PublicProfile } from "~/backend/handlers/profile/profile-view";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { HeroSection } from "./hero-section";
import { FALLBACK_PROFILE_PHOTO } from "~/lib/profile-fallback";
import { sampleProfile } from "~/frontend/components/profile/profile-fixture";

/*
 * Bridgy / Bridgy Fed が「誰のサイトか」を読むための印。壊れても画面には何も出ないので、
 * ここで形を固定する (印が消えると、静かに橋が架からなくなる)。
 */
function renderHero(profile: PublicProfile | null = sampleProfile): HTMLElement {
  const { container } = render(
    <MemoryRouter>
      <HeroSection clockOrigin={{ minutesOfDay: 12 * 60, moonAgeDay: 14 }} profile={profile} />
    </MemoryRouter>,
  );
  return container;
}

describe("HeroSection の microformats2", () => {
  it("代表 h-card を 1 つだけ置く", () => {
    const container = renderHero();
    expect(container.querySelectorAll(":scope .h-card")).toHaveLength(1);
  });

  it("h-card に名前・サイト・顔を持たせる", () => {
    const card = renderHero().querySelector(":scope .h-card");
    expect(card?.querySelector(":scope .p-name")?.textContent).toBe(sampleProfile.name);
    expect(card?.querySelector(":scope .u-url")?.getAttribute("href")).toBe("/");
    expect(card?.querySelector(":scope .u-photo")?.getAttribute("src")).toBe(
      sampleProfile.avatarUrl,
    );
  });

  it("顔は読み上げに出さない", () => {
    // 見せるための絵ではなく、機械に渡すためだけの参照。
    const photo = renderHero().querySelector(":scope .u-photo");
    expect(photo?.getAttribute("alt")).toBe("");
  });

  it("相互リンクのある先にだけ rel=me を付ける", () => {
    const container = renderHero();
    const me = [...container.querySelectorAll(':scope a[rel~="me"]')].map((link) =>
      link.getAttribute("href"),
    );
    expect(me).toEqual(
      sampleProfile.socials.filter((social) => social.isMe).map((social) => social.url),
    );
  });

  it("rel=me を付けない先にも安全な rel は残す", () => {
    const container = renderHero();
    const x = container.querySelector(':scope a[href="https://x.com/yantene"]');
    expect(x?.getAttribute("rel")).toBe("noopener noreferrer");
  });
});

/*
 * 初回同期の前と、コンテンツリポジトリの事故で読めなかったとき。**殻は立ったままでなければ
 * ならない。** 名前と顔と自分への参照が消えると、Bridgy Fed から見て「誰のサイトか
 * 分からない」状態になり、橋が黙って架からなくなる。
 */
describe("プロフィールがまだ無いとき", () => {
  it("代表 h-card の殻は立てる", () => {
    const card = renderHero(null).querySelector(":scope .h-card");
    expect(card).not.toBeNull();
    expect(card?.querySelector(":scope .p-name")?.textContent).toBe("やんてね");
    expect(card?.querySelector(":scope .u-url")?.getAttribute("href")).toBe("/");
    expect(card?.querySelector(":scope .u-photo")?.getAttribute("src")).toBe(
      FALLBACK_PROFILE_PHOTO,
    );
  });

  it("自己紹介と出ていく先は出さない", () => {
    const container = renderHero(null);
    expect(container.querySelectorAll(':scope a[rel~="me"]')).toHaveLength(0);
    expect(container.querySelector(":scope ul")).toBeNull();
  });
});
