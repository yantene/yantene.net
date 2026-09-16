import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { sampleHistory } from "./profile-fixture";
import { ProfileHistory } from "./profile-history";

/*
 * 経歴には microformats の印を付けない (ADR 0044)。
 *
 * 経歴は読み物として画面に出すもので、機械に名乗る身元の一部ではない。生年月日と
 * 出身地を機械が読む形で持たないこと (#508) と同じ線引きで、`dt-*` を足すと経歴の
 * 側からその線引きが崩れる。
 *
 * **黙って壊れる向きの間違いなので、形で止める。** 印は 1 つ足しても画面は何も変わらず、
 * 変わるのは Bridgy Fed や h-card のパーサから見た姿だけ。
 */
function renderHistory(): HTMLElement {
  const { container } = render(<ProfileHistory history={sampleHistory} />);
  return container;
}

/** mf2 の語彙の接頭辞。h-card / h-entry の入れ子と、その中の各印。 */
const MF2_PREFIXES = ["h-", "p-", "u-", "dt-", "e-"];

describe("ProfileHistory の microformats2", () => {
  it("microformats の印を 1 つも置かない", () => {
    const container = renderHistory();
    const found = [...container.querySelectorAll("*")].flatMap((element) =>
      [...element.classList].filter((name) =>
        MF2_PREFIXES.some((prefix) => name.startsWith(prefix)),
      ),
    );

    expect(found).toEqual([]);
  });

  /*
   * `time` も置かない。年だけの札に機械が読む日付を持たせると、結局「経歴を機械に
   * 読ませる形」になる。
   */
  it("time 要素を置かない", () => {
    expect(renderHistory().querySelectorAll("time")).toHaveLength(0);
  });
});

describe("ProfileHistory の形", () => {
  it("章ごとに見出しを立て、渡された順に出す", () => {
    const container = renderHistory();
    const headings = [...container.querySelectorAll("h3")].map((node) => node.textContent);

    expect(headings).toEqual(["高校", "大学"]);
  });

  it("行き先のある出来事だけをリンクにする", () => {
    const links = [...renderHistory().querySelectorAll("a")];

    expect(links).toHaveLength(1);
    expect(links[0]?.getAttribute("href")).toBe("https://www.youtube.com/watch?v=Ki1qb9q4z8E");
    expect(links[0]?.textContent).toContain("セキュリティ・キャンプ中央大会 2012");
  });

  it("補足は書いてあるものだけ出す", () => {
    const notes = [...renderHistory().querySelectorAll(".profile-history-note")];

    expect(notes.map((node) => node.textContent)).toEqual([
      "CTF チーム優勝 (チーム名: `|`、6424 points)",
    ]);
  });
});
