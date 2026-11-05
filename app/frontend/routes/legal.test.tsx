import { screen } from "@testing-library/react";
import { createRoutesStub } from "react-router";
import { withI18n } from "~/frontend/lib/test-render";

const renderWithI18n = withI18n();
import { describe, expect, it } from "vitest";
import Legal, { AMAZON_ASSOCIATES_STATEMENT, ATTRIBUTIONS } from "./legal";
import { googleFontFamilies } from "~/frontend/root";
import { translationsFor } from "~/frontend/lib/page-meta";
import { supportedLocales } from "~/lib/i18n/locale";
import routes from "~/frontend/routes";

/*
 * 絵文字の意匠 (CC BY 4.0) と書体 (SIL OFL 1.1) は、帰属の表示が使用の条件になっている。
 * 見た目の都合で外せる類のものではないので、消えたら落ちるようにしておく。
 *
 * フッターからこのページへ繋がっていること自体は footer.test.tsx が見張る。片方だけでは
 * 足りない。リンクが残ったまま中身が消えても、中身が残ったままリンクが消えても、
 * 読み手から帰属は見えなくなる。
 */
async function renderPage(): Promise<void> {
  const Stub = createRoutesStub([
    {
      path: "/legal",
      Component: Legal,
      loader: () => ({
        locale: "ja",
        origin: "https://yantene.net",
        copyright: { from: 2024, to: 2026 },
      }),
    },
  ]);

  renderWithI18n(<Stub initialEntries={["/legal"]} />, { router: false });

  // loader の解決を待つ。描き終わるまでは何も出ていない。
  // 場所の名前は日本語モードでも英語のまま (app/lib/i18n/locales/locales.test.ts)。
  await screen.findByRole("heading", { name: "Legal", level: 1 });
}

describe("/legal", () => {
  it("絵文字の意匠の帰属を出す", async () => {
    await renderPage();

    expect(screen.getByRole("link", { name: "Twemoji" })).toHaveAttribute(
      "href",
      "https://github.com/jdecked/twemoji",
    );
    expect(screen.getAllByRole("link", { name: "CC BY 4.0" })).not.toHaveLength(0);
  });

  it("書体の帰属を出す", async () => {
    await renderPage();

    expect(screen.getByRole("link", { name: "Noto Sans JP" })).toBeVisible();
    expect(screen.getByRole("link", { name: "STIX Two Math" })).toBeVisible();
    expect(screen.getAllByRole("link", { name: "SIL Open Font License 1.1" })).toHaveLength(2);
  });

  /*
   * Amazon アソシエイトの運営規約 (第 5 条) が、サイトのどこかに出すことを求めている。
   * 記事の本文には書かずここ 1 か所に置くので、消えると規約を外れる。
   */
  it("Amazon アソシエイトの表示を規約の文言のまま出す", async () => {
    await renderPage();

    expect(screen.getByRole("heading", { name: "Affiliate links", level: 2 })).toBeVisible();
    expect(screen.getByText(AMAZON_ASSOCIATES_STATEMENT)).toBeVisible();
  });
});

/*
 * ページの中身とフッターのリンクが両方あっても、ルートの登録が外れれば行き先は 404 に
 * なる。createRoutesStub は routes.ts を読まないので、上の 2 つでは捕まらない。
 */
describe("/legal の登録", () => {
  it("routes.ts に /legal がある", () => {
    expect(routes.some((route) => "path" in route && route.path === "legal")).toBe(true);
  });
});

/*
 * 帰属の一覧は手で書く。root.tsx が読む書体を増やしたときに、ここへ足し忘れても
 * ページは「表示が条件になっているものを挙げた」という顔のまま黙って通ってしまう。
 * 読んでいる書体の側を正として突き合わせる。
 */
describe("読み込んでいる書体の帰属", () => {
  it.each(googleFontFamilies.map(({ name }) => name))("%s の帰属が /legal にある", (name) => {
    expect(ATTRIBUTIONS.some((attribution) => attribution.name === name)).toBe(true);
  });
});

/*
 * 用途の文言は翻訳リソースから引く。キーを打ち間違えても i18next はキー文字列を
 * そのまま返すので、ページには `licenses.usage.notoSerif` のような生の文字列が出る。
 * テストもスモークも通ってしまう (本文の CC BY 4.0 は出ているため) ので、ここで見張る。
 *
 * 上の「足し忘れ」の検査と対にする。項目を足したのにキーが無い、キーはあるのに項目が
 * 無い、のどちらでも読み手には帰属が届かない。
 */
describe("帰属の用途の文言", () => {
  it.each(ATTRIBUTIONS.map((attribution) => [attribution.name, attribution.usageKey]))(
    "%s の usageKey (%s) が ja / en の両方にある",
    (_name, usageKey) => {
      for (const locale of supportedLocales) {
        const resolved = translationsFor(locale);
        const value = usageKey
          .split(".")
          .reduce<unknown>(
            (node, key) =>
              typeof node === "object" && node !== null
                ? (node as Record<string, unknown>)[key]
                : undefined,
            resolved,
          );

        expect(typeof value, `${locale} に ${usageKey} が無い`).toBe("string");
      }
    },
  );
});
