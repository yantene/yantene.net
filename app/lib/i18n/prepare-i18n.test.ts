import { afterEach, describe, expect, it, vi } from "vitest";
import { defaultLocale } from "~/lib/i18n/locale";
import { prepareI18n } from "~/lib/i18n/prepare-i18n";

const resolveLocale = vi.hoisted(() => vi.fn<(request: Request) => string>());

vi.mock("~/lib/i18n/resolve-locale", () => ({ resolveLocale }));

afterEach(() => {
  vi.restoreAllMocks();
  resolveLocale.mockReset();
});

function anyRequest(): Request {
  return new Request("https://yantene.net/");
}

describe("prepareI18n", () => {
  it("決まったロケールで翻訳を用意する", async () => {
    resolveLocale.mockReturnValue("ja");

    const i18n = await prepareI18n(anyRequest());

    expect(i18n.language).toBe("ja");
  });

  /*
   * ここは entry.server.tsx の助走、つまりどの ErrorBoundary の外で走る。投げると
   * 全ルートが素の 500 になり、原因が読み手のヘッダーなら cookie を消すまで直らない
   * (#309)。ロケールは中身をこちらで決められない値なので、決められないことを異常と
   * して扱わない。
   */
  it("ロケールを決められなくても投げず、既定に倒す", async () => {
    resolveLocale.mockImplementation(() => {
      throw new Error("broken header");
    });
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const create = vi.spyOn(
      await import("~/lib/i18n/init"),
      "createI18nInstance",
    );

    await prepareI18n(anyRequest());

    /*
     * 出来上がった instance の language ではなく、**渡した引数**を見る。i18next の
     * fallbackLng が既定と同じなので、空文字を渡しても language は既定になり、
     * 「既定を渡した」と「でたらめを渡した」を見分けられない。
     */
    expect(create).toHaveBeenCalledWith(defaultLocale);
    // 静かに劣化させない。倒したことは残す。
    expect(logged).toHaveBeenCalledTimes(1);
  });

  /*
   * 翻訳そのものを用意できないのはこちら側の異常。握って既定で描き直すと、日本語を
   * 求めた読み手に英語のページを黙って返し続けることになる。
   */
  it("翻訳を用意できなければ投げる", async () => {
    resolveLocale.mockReturnValue("ja");
    const create = vi
      .spyOn(await import("~/lib/i18n/init"), "createI18nInstance")
      .mockRejectedValue(new Error("no resources"));

    await expect(prepareI18n(anyRequest())).rejects.toThrow("no resources");
    // 既定で試し直さない (同じ理由で失敗するうえ、失敗を隠すことになる)。
    expect(create).toHaveBeenCalledTimes(1);
  });
});
