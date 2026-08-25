import { render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { createRoutesStub } from "react-router";
import { beforeAll, describe, expect, it } from "vitest";
import Licenses, { ATTRIBUTIONS } from "./licenses";
import type { i18n } from "i18next";
import { googleFontFamilies } from "~/frontend/root";
import routes from "~/frontend/routes";
import { createI18nInstance } from "~/lib/i18n/init";

/*
 * 絵文字の意匠 (CC BY 4.0) と書体 (SIL OFL 1.1) は、帰属の表示が使用の条件になっている。
 * 見た目の都合で外せる類のものではないので、消えたら落ちるようにしておく。
 *
 * フッターからこのページへ繋がっていること自体は footer.test.tsx が見張る。片方だけでは
 * 足りない。リンクが残ったまま中身が消えても、中身が残ったままリンクが消えても、
 * 読み手から帰属は見えなくなる。
 */
const i18nRef: { current: i18n | undefined } = { current: undefined };

beforeAll(async () => {
  i18nRef.current = await createI18nInstance("ja");
});

async function renderPage(): Promise<void> {
  const instance = i18nRef.current;
  if (instance === undefined) throw new Error("i18n is not ready");

  const Stub = createRoutesStub([
    {
      path: "/licenses",
      Component: Licenses,
      loader: () => ({
        locale: "ja",
        origin: "https://yantene.net",
        copyright: { from: 2024, to: 2026 },
      }),
    },
  ]);

  render(
    <I18nextProvider i18n={instance}>
      <Stub initialEntries={["/licenses"]} />
    </I18nextProvider>,
  );

  // loader の解決を待つ。描き終わるまでは何も出ていない。
  await screen.findByRole("heading", { name: "奥付" });
}

describe("ライセンスのページ", () => {
  it("絵文字の意匠の帰属を出す", async () => {
    await renderPage();

    expect(screen.getByRole("link", { name: "Twemoji" })).toHaveAttribute(
      "href",
      "https://github.com/jdecked/twemoji",
    );
    expect(screen.getAllByRole("link", { name: "CC BY 4.0" })).not.toHaveLength(
      0,
    );
  });

  it("書体の帰属を出す", async () => {
    await renderPage();

    expect(screen.getByRole("link", { name: "Noto Sans JP" })).toBeVisible();
    expect(screen.getByRole("link", { name: "STIX Two Math" })).toBeVisible();
    expect(
      screen.getAllByRole("link", { name: "SIL Open Font License 1.1" }),
    ).toHaveLength(2);
  });
});

/*
 * ページの中身とフッターのリンクが両方あっても、ルートの登録が外れれば行き先は 404 に
 * なる。createRoutesStub は routes.ts を読まないので、上の 2 つでは捕まらない。
 */
describe("ライセンスのページの登録", () => {
  it("routes.ts に /licenses がある", () => {
    expect(
      routes.some((route) => "path" in route && route.path === "licenses"),
    ).toBe(true);
  });
});

/*
 * 帰属の一覧は手で書く。root.tsx が読む書体を増やしたときに、ここへ足し忘れても
 * ページは「表示が条件になっているものを挙げた」という顔のまま黙って通ってしまう。
 * 読んでいる書体の側を正として突き合わせる。
 */
describe("読み込んでいる書体の帰属", () => {
  it.each(googleFontFamilies.map(({ name }) => name))(
    "%s の帰属が /licenses にある",
    (name) => {
      expect(
        ATTRIBUTIONS.some((attribution) => attribution.name === name),
      ).toBe(true);
    },
  );
});
