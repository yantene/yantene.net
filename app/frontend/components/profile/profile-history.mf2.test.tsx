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

/*
 * mf2 の語彙を名指しで並べる。
 *
 * ⚠️ **接頭辞 (`h-` / `p-` …) だけで見ないこと。** Tailwind の `p-2` (余白) や `h-4`
 * (高さ) が引っかかり、余白を足しただけの人が microformats の ADR へ送られる。
 * ここは「印を置くな」の検査であって「その綴りを使うな」の検査ではない。
 */
const MF2_CLASSES = new Set([
  "h-card",
  "h-entry",
  "h-feed",
  "h-event",
  "p-name",
  "p-summary",
  "p-note",
  "p-author",
  "p-category",
  "u-url",
  "u-uid",
  "u-photo",
  "u-email",
  "dt-published",
  "dt-updated",
  "dt-bday",
  "dt-start",
  "dt-end",
  "e-content",
]);

describe("ProfileHistory の microformats2", () => {
  it("microformats の印を 1 つも置かない", () => {
    const container = renderHistory();
    const found = [...container.querySelectorAll("*")].flatMap((element) =>
      [...element.classList].filter((name) => MF2_CLASSES.has(name)),
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

  /*
   * 札は書き手が書いた精度のまま出る。**混ざるのは承知の上**で、日まで覚えている
   * 出来事とそうでない出来事が並ぶ。
   *
   * 終わりのある出来事は、始まりと重なる位を畳む (`2012-02-20 〜 24`)。畳まずに両端を
   * 書くと 5 日間の合宿の札が 24 字になって本文より目立つ。
   */
  it("札は書いた精度のまま出し、終わりは重なる位を畳む", () => {
    const stamps = [...renderHistory().querySelectorAll(".profile-history-year")].map(
      (node) => node.textContent,
    );

    expect(stamps).toEqual([
      "2011-06-04",
      "2012-02-20 〜 24",
      "2012-03",
      "2012-04",
      "2012-08-14 〜 18",
      "2018",
    ]);
  });

  /*
   * ⚠️ **行き先の絵は字より先に置く。** 後ろに置くと、狭い画面で絵だけが次の行に
   * 取り残される (#522)。リンクは段落の先頭から始まるので、前に置けば取り残されない。
   * 見た目にしか出ない壊れ方で、しかも字の長さと画面の幅が噛み合ったときにしか出ない。
   */
  it("行き先の絵はリンクの先頭に置く", () => {
    const [link] = [...renderHistory().querySelectorAll("a")];

    expect(link?.firstElementChild?.className).toContain("profile-history-external");
    expect(link?.textContent).toBe("セキュリティ・キャンプ中央大会 2012 Web・セキュリティ・クラス");
  });

  /*
   * 畳み方は始まりと終わりのどこが重なるかで決まる。見本には同月の期間しか入っていない
   * ので、月をまたぐ・年をまたぐ場合をここで並べる。**最後の位は必ず残す**
   * (`2012-08-14 〜 ` のような尻切れを作らない)。
   */
  it.each([
    ["同じ月", "2012-08-14", "2012-08-18", "2012-08-14 〜 18"],
    ["月をまたぐ", "2012-08-14", "2012-09-02", "2012-08-14 〜 09-02"],
    ["年をまたぐ", "2012-12-28", "2013-01-03", "2012-12-28 〜 2013-01-03"],
    ["月の精度", "2012-08", "2012-09", "2012-08 〜 09"],
    ["年の精度", "2011", "2013", "2011 〜 2013"],
  ])("%s の期間は重なる位を畳む", (_label, date, until, expected) => {
    const { container } = render(
      <ProfileHistory
        history={[
          { chapter: "章", entries: [{ date, until, text: "出来事", url: null, note: null }] },
        ]}
      />,
    );

    expect(container.querySelector(".profile-history-year")?.textContent).toBe(expected);
  });

  it("補足は書いてあるものだけ出す", () => {
    const notes = [...renderHistory().querySelectorAll(".profile-history-note")];

    expect(notes.map((node) => node.textContent)).toEqual([
      "CTF チーム優勝 (チーム名: |、6424 points)",
    ]);
  });
});
