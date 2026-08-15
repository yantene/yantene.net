import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { filterPalette } from "./emoji-palette-data";

const groups = [
  {
    name: "スマイリーと感情",
    emojis: [
      { u: "😀", l: "にっこり笑う", t: ["スマイル", "笑顔"] },
      { u: "😢", l: "泣く", t: ["悲しい"] },
    ],
  },
  {
    name: "動物自然",
    emojis: [{ u: "🐈", l: "ねこ", t: ["ペット", "くろねこ"] }],
  },
];

describe("filterPalette", () => {
  it("語が空なら全部そのまま返す", () => {
    expect(filterPalette(groups, "  ")).toBe(groups);
  });

  it("名前で絞り込む", () => {
    expect(filterPalette(groups, "ねこ")).toEqual([
      { name: "動物自然", emojis: [groups[1]?.emojis[0]] },
    ]);
  });

  /* タグは名前に無い言い回しを拾うために持っている。 */
  it("タグでも当たる", () => {
    expect(filterPalette(groups, "悲しい")).toEqual([
      { name: "スマイリーと感情", emojis: [groups[0]?.emojis[1]] },
    ]);
  });

  /*
   * 日本語には語の区切りが無いので、前方一致では「くろねこ」を「ねこ」で拾えない。
   * 含むかどうかで判ずる。
   */
  it("語の途中でも当たる", () => {
    expect(filterPalette(groups, "ろね")[0]?.emojis[0]?.u).toBe("🐈");
  });

  it("大文字と小文字を区別しない", () => {
    const latin = [
      { name: "Smileys", emojis: [{ u: "😀", l: "Grinning", t: [] }] },
    ];

    expect(filterPalette(latin, "GRIN")[0]?.emojis).toHaveLength(1);
  });

  /* 当たらなかった分類は畳む。空の見出しだけが並ぶのを避ける。 */
  it("何も当たらない分類は返さない", () => {
    expect(filterPalette(groups, "みつからない")).toEqual([]);
  });
});

/** fetch の差し替え。Promise を返すことを型に持たせないと、渡す実装が void 扱いになる。 */
type FetchStub = (url: string) => Promise<Response>;

/** 取りに行くたびに新しい返事を作る。同じ Response を使い回すと本文が 2 度は読めない。 */
function respondWithGroups(): Promise<Response> {
  return Promise.resolve(Response.json(groups));
}

describe("loadPalette", () => {
  let fetchMock: ReturnType<typeof vi.fn<FetchStub>>;

  beforeEach(() => {
    fetchMock = vi.fn<FetchStub>();
    vi.stubGlobal("fetch", fetchMock);
    /*
     * 取りに行った結果の握りはモジュールに載っている。先のテストが取り寄せを済ませていると
     * 失敗そのものを作れないので、テストごとに読み直して真新しい握りから始める。
     */
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /*
   * 転けた Promise を握り続けると、通信が切れている間に一度開いただけで、そのタブでは
   * 二度と絵文字が並ばなくなる。開き直しても同じ拒否を引き当て、読み手がページを
   * 読み直すまで直らない (issue #252)。
   */
  it("取りに行って転けても、次に呼んだときは取り直す", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    fetchMock.mockImplementation(respondWithGroups);
    const { loadPalette } = await import("./emoji-palette-data");

    await expect(loadPalette("ja")).rejects.toThrow();
    await expect(loadPalette("ja")).resolves.toEqual(groups);

    // 拒否済みの Promise を握っていれば、2 度目は取りに行かないまま同じ拒否が返る。
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  /* 200 で返らなかったときも同じ。次に開けば取り直せる。 */
  it("返事が 200 でなくても、次に呼んだときは取り直す", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 500 }));
    fetchMock.mockImplementation(respondWithGroups);
    const { loadPalette } = await import("./emoji-palette-data");

    await expect(loadPalette("ja")).rejects.toThrow(/500/);
    await expect(loadPalette("ja")).resolves.toEqual(groups);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  /* 開き直すたびに取りに行くと、閉じて開くだけで数百 KB の通信が増える。 */
  it("一度読めたら覚えておいて、二度は取りに行かない", async () => {
    fetchMock.mockImplementation(respondWithGroups);
    const { loadPalette } = await import("./emoji-palette-data");

    const first = await loadPalette("ja");
    const second = await loadPalette("ja");

    expect(second).toBe(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
