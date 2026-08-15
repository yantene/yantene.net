import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import { HeroSection } from "./hero-section";

/*
 * Bridgy / Bridgy Fed が「誰のサイトか」を読むための印。壊れても画面には何も出ないので、
 * ここで形を固定する (印が消えると、静かに橋が架からなくなる)。
 */
function renderHero(): HTMLElement {
  const { container } = render(
    <MemoryRouter>
      <HeroSection clockOrigin={{ minutesOfDay: 12 * 60, moonAgeDay: 14 }} />
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
    expect(card?.querySelector(":scope .p-name")?.textContent).toBe("やんてね");
    expect(card?.querySelector(":scope .u-url")?.getAttribute("href")).toBe(
      "/",
    );
    expect(card?.querySelector(":scope .u-photo")?.getAttribute("src")).toBe(
      "/icons/icon-192.png",
    );
  });

  it("顔は読み上げに出さない", () => {
    // 見せるための絵ではなく、機械に渡すためだけの参照。
    const photo = renderHero().querySelector(":scope .u-photo");
    expect(photo?.getAttribute("alt")).toBe("");
  });

  it("相互リンクのある先にだけ rel=me を付ける", () => {
    const container = renderHero();
    const me = [...container.querySelectorAll(':scope a[rel~="me"]')].map(
      (link) => link.getAttribute("href"),
    );
    expect(me).toEqual([
      "https://github.com/yantene",
      "https://bsky.app/profile/yantene.net",
      "https://mastodon.social/@yantene",
    ]);
  });

  it("rel=me を付けない先にも安全な rel は残す", () => {
    const container = renderHero();
    const x = container.querySelector(':scope a[href="https://x.com/yantene"]');
    expect(x?.getAttribute("rel")).toBe("noopener noreferrer");
  });
});
