import { screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { withI18n } from "~/frontend/lib/test-render";

const renderWithI18n = withI18n();
import { describe, expect, it } from "vitest";
import About from "./about";
import type { AboutPageData } from "~/backend/handlers/profile/about-page.handler";
import type { PublicProfile } from "~/backend/handlers/profile/profile-view";

/*
 * `/about` はプロフィールの有無で 2 通りに描かれる (ADR 0041)。
 *
 * **中身が無いときに落とさない**ことが要点で、初回の refresh の前と `profile.md` を
 * 消した直後がそれに当たる。ナビは常に About を指しているので、そこで 500 を出すと
 * サイトが壊れて見える。
 */
const PROFILE: PublicProfile = {
  name: "吉田 周平 (Shuhei YOSHIDA)",
  dateOfBirth: "1993-11-18",
  birthplace: "愛知県刈谷市",
  tagline: "一介のコンピュータ好き。\n東京で Web 開発をしている。",
  socials: [
    { platform: "github", url: "https://github.com/yantene", isMe: true },
    { platform: "discord", url: "https://discord.com/users/yantene", isMe: false },
  ],
};

const BODY = {
  type: "root",
  children: [
    { type: "heading", depth: 2, children: [{ type: "text", value: "Favorites" }] },
    { type: "paragraph", children: [{ type: "text", value: "コンピュータが好きだ。" }] },
  ],
};

async function renderPage(data: Partial<AboutPageData>): Promise<HTMLElement> {
  const Stub = createRoutesStub([
    {
      path: "/about",
      Component: About,
      loader: () => ({
        locale: "ja",
        origin: "https://yantene.net",
        copyright: { from: 2003, to: 2026 },
        profile: null,
        mdast: null,
        jsonLd: undefined,
        ...data,
      }),
    },
  ]);

  const { container } = renderWithI18n(<Stub initialEntries={["/about"]} />, { router: false });

  // loader の解決を待つ。描き終わるまでは何も出ていない。
  await screen.findByRole("heading", { level: 1 });
  return container;
}

describe("/about", () => {
  describe("プロフィールがあるとき", () => {
    it("名前・自己紹介・生年月日・出身地を出す", async () => {
      await renderPage({ profile: PROFILE, mdast: BODY as never });

      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(PROFILE.name);
      expect(screen.getByText(/一介のコンピュータ好き。/)).toBeInTheDocument();
      // 日付はサイト共通の書式で出す (記事の日付と揃える)。
      expect(screen.getByText("1993.11.18")).toBeInTheDocument();
      expect(screen.getByText("愛知県刈谷市")).toBeInTheDocument();
    });

    it("本文 (MDAST) を描く", async () => {
      await renderPage({ profile: PROFILE, mdast: BODY as never });

      expect(screen.getByRole("heading", { level: 2, name: /Favorites/ })).toBeInTheDocument();
      expect(screen.getByText("コンピュータが好きだ。")).toBeInTheDocument();
    });

    it("「準備中」には倒さない", async () => {
      await renderPage({ profile: PROFILE, mdast: BODY as never });

      expect(screen.queryByText("Coming soon")).not.toBeInTheDocument();
    });
  });

  describe("プロフィールがまだ無いとき", () => {
    it("落とさずに「準備中」を出す", async () => {
      await renderPage({});

      expect(screen.getByText("Coming soon")).toBeInTheDocument();
      expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("About");
    });
  });
});
