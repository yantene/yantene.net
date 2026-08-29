import { screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Footer } from "./footer";
import { withI18n } from "~/frontend/lib/test-render";

// 中の導線が翻訳を引くため、本体と同じ i18n を与えて描く。
const renderWithI18n = withI18n("en");

/**
 * 著作権表示の期間は loader が決めて props で渡る (#156)。
 *
 * かつてはこのコンポーネントがモジュールスコープで時計を読んでいた。Cloudflare Workers は
 * I/O の外の時刻を Unix epoch 0 に固定するため、本番の SSR だけが `© 1970` を返し、
 * hydration で差し替わって全ページが mismatch を起こしていた。
 */
describe("Footer", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  function renderFooter(from: number, to: number): void {
    renderWithI18n(<Footer copyright={{ from, to }} />);
  }

  it("最初のノートの年から最後のノートの年までを出す", () => {
    renderFooter(2019, 2026);

    expect(screen.getByRole("contentinfo")).toHaveTextContent(
      "Copyright © 2019 – 2026 やんてね All rights reserved.",
    );
  });

  it("年が 1 つしか無いときは期間にしない", () => {
    renderFooter(2026, 2026);

    const footer = screen.getByRole("contentinfo");
    expect(footer).toHaveTextContent("Copyright © 2026 やんてね All rights reserved.");
    expect(footer).not.toHaveTextContent("2026 – 2026");
  });

  it("自分では時計を読まない", () => {
    // Workers がモジュールのトップレベル評価に見せる時刻 (Unix epoch 0) を再現する。
    vi.useFakeTimers();
    vi.setSystemTime(0);

    renderFooter(2019, 2026);

    expect(screen.getByRole("contentinfo")).toHaveTextContent(
      "Copyright © 2019 – 2026 やんてね All rights reserved.",
    );
    expect(screen.getByRole("contentinfo")).not.toHaveTextContent("1970");
  });

  /*
   * 絵文字と書体の帰属はライセンスのページが持つ。CC BY 4.0 は帰属をまとめた場所への
   * リンクでも条件を満たせると定めているが、それはリンクが実際にあることが前提なので、
   * 消えたら落ちるようにしておく (帰属そのものは licenses.test.tsx が見張る)。
   */
  it("ライセンスのページへ繋ぐ", () => {
    renderFooter(2019, 2026);

    expect(screen.getByRole("link", { name: "Open source licenses" })).toHaveAttribute(
      "href",
      "/licenses",
    );
  });
});
