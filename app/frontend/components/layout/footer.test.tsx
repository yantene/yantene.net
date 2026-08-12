import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Footer } from "./footer";
import type { i18n } from "i18next";
import { createI18nInstance } from "~/lib/i18n/init";

/**
 * 著作権表示の年は loader が決めて props で渡る (#156)。
 *
 * かつてはこのコンポーネントがモジュールスコープで時計を読んでいた。Cloudflare Workers は
 * I/O の外の時刻を Unix epoch 0 に固定するため、本番の SSR だけが `© 1970` を返し、
 * hydration で差し替わって全ページが mismatch を起こしていた。
 */
describe("Footer", () => {
  // 中の購読導線が翻訳を引くため、本体と同じ i18n を与えて描く。
  let i18n: i18n;

  beforeAll(async () => {
    i18n = await createI18nInstance("en");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function renderFooter(year: number): void {
    render(
      <I18nextProvider i18n={i18n}>
        <Footer year={year} />
      </I18nextProvider>,
    );
  }

  it("渡された年を著作権表示に出す", () => {
    renderFooter(2026);

    expect(screen.getByRole("contentinfo")).toHaveTextContent(
      "© 2026 yantene.net",
    );
  });

  it("自分では時計を読まない", () => {
    // Workers がモジュールのトップレベル評価に見せる時刻 (Unix epoch 0) を再現する。
    vi.useFakeTimers();
    vi.setSystemTime(0);

    renderFooter(2026);

    expect(screen.getByRole("contentinfo")).toHaveTextContent(
      "© 2026 yantene.net",
    );
    expect(screen.getByRole("contentinfo")).not.toHaveTextContent("1970");
  });
});
