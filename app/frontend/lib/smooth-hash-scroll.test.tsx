import { fireEvent, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";
import { useSmoothHashScroll } from "./smooth-hash-scroll";

/*
 * 滑らせてよい印は <html> の属性で立てる。
 *
 * ここで固定したいのは「どのリンクで立つか」の一点。据え置きの
 * `scroll-behavior: smooth` にすると <ScrollRestoration> のページ遷移と戻る操作まで
 * 滑ってしまうので、立つ範囲が広がっていないことを見張る。
 */
const ATTRIBUTE = "data-smooth-scroll";

function Harness({ children }: { readonly children: React.ReactNode }): React.JSX.Element {
  useSmoothHashScroll();
  return <div>{children}</div>;
}

/** 押しても実際に遷移させない。行き先の形だけが要る。 */
function link(href: string, label: string): React.JSX.Element {
  return (
    <a
      href={href}
      onClick={(event) => {
        event.preventDefault();
      }}
    >
      {label}
    </a>
  );
}

function isMarked(): boolean {
  return document.documentElement.hasAttribute(ATTRIBUTE);
}

describe("useSmoothHashScroll", () => {
  afterEach(() => {
    document.documentElement.removeAttribute(ATTRIBUTE);
  });

  it("いま見ているページの中を指すリンクで印が立つ", async () => {
    const { getByText } = render(
      <Harness>{link(`${window.location.pathname}#section`, "節へ")}</Harness>,
    );
    await userEvent.click(getByText("節へ"));
    expect(isMarked()).toBe(true);
  });

  it("別のページへのリンクでは立たない (上端へ戻る動きを滑らせない)", async () => {
    const { getByText } = render(<Harness>{link("/articles/other#section", "別の記事")}</Harness>);
    await userEvent.click(getByText("別の記事"));
    expect(isMarked()).toBe(false);
  });

  it("ハッシュを持たないリンクでは立たない", async () => {
    const { getByText } = render(<Harness>{link(window.location.pathname, "同じページ")}</Harness>);
    await userEvent.click(getByText("同じページ"));
    expect(isMarked()).toBe(false);
  });

  it("外部のリンクでは立たない", async () => {
    const { getByText } = render(<Harness>{link("https://example.com/#x", "外")}</Harness>);
    await userEvent.click(getByText("外"));
    expect(isMarked()).toBe(false);
  });

  /*
   * 修飾キー付きの押下は fireEvent で作る。userEvent の押下には修飾キーが乗らず、
   * ここで見たい分岐 (metaKey などを見て降りる) を通らない。
   */
  it("修飾キー付きの押下では立たない (別のタブへ開くので、この文書は動かない)", () => {
    const { getByText } = render(
      <Harness>{link(`${window.location.pathname}#section`, "節へ")}</Harness>,
    );
    fireEvent.click(getByText("節へ"), { metaKey: true });
    expect(isMarked()).toBe(false);
  });
});
