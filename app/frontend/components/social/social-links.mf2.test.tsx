import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SocialLinks } from "./social-links";
import { sampleProfile } from "~/frontend/components/profile/profile-fixture";

/*
 * 出ていく先のリンクの張り方。
 *
 * **メールだけ他と違う。** 違いは見た目に出ないので (どれも同じ台に載った黒い絵)、
 * 壊れても気づけない。ここで形を固定する。
 */
function renderLinks(): HTMLElement {
  const { container } = render(
    <SocialLinks links={sampleProfile.socials} className="flex" linkClassName="text-2xl" />,
  );
  return container;
}

function linkFor(container: HTMLElement, platform: string): HTMLAnchorElement {
  const link = container.querySelector<HTMLAnchorElement>(`a.social-link-${platform}`);
  expect(link).not.toBeNull();
  return link as HTMLAnchorElement;
}

describe("SocialLinks のリンクの張り方", () => {
  /*
   * `mailto:` に `target="_blank"` を付けると、メーラーが立ち上がったうえで空のタブが
   * 1 枚残る。押した人から見ると「開いたのに何も無いタブ」ができる。
   */
  it("メールは別タブで開かない", () => {
    const container = renderLinks();
    expect(linkFor(container, "email")).not.toHaveAttribute("target");
    expect(linkFor(container, "github")).toHaveAttribute("target", "_blank");
  });

  /*
   * `u-email` は h-card の連絡先。`u-url` や `u-photo` と同じ役で、読んだ側が
   * 「この人に届く宛先」として拾う。
   */
  it("メールにだけ u-email を名乗らせる", () => {
    const container = renderLinks();
    expect(linkFor(container, "email")).toHaveClass("u-email");
    expect(linkFor(container, "github")).not.toHaveClass("u-email");
  });

  /*
   * `noopener` / `noreferrer` は「開いた先から `window.opener` を辿られない」ための印。
   * `mailto:` は文書を開かないので意味が無い。`me` のほうは効く (RelMeAuth は
   * メールアドレスも身元として辿る)。
   */
  it("メールの rel には me だけを置く", () => {
    const mail = linkFor(renderLinks(), "email");
    expect(mail.getAttribute("rel")).toBe("me");
  });

  /*
   * よその会社の印は色を変えてはいけない (ADR 0043)。封筒は誰のロゴでもないので、
   * その規定は掛からない。**印でないものに印の名を付けない。**
   */
  it("封筒には brand-mark を付けない", () => {
    const container = renderLinks();
    expect(linkFor(container, "email").querySelector("svg")).not.toHaveClass("brand-mark");
    expect(linkFor(container, "github").querySelector("svg")).toHaveClass("brand-mark");
  });
});
