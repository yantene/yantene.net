import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareI18n } from "~/lib/i18n/prepare-i18n";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("prepareI18n", () => {
  it("渡されたロケールで翻訳を用意する", async () => {
    const i18n = await prepareI18n("ja");

    expect(i18n.language).toBe("ja");
  });

  /*
   * 翻訳そのものを用意できないのはこちら側の異常。握って既定で描き直すと、日本語を
   * 求めた読み手に英語のページを黙って返し続けることになる。
   */
  it("翻訳を用意できなければ投げる", async () => {
    const create = vi
      .spyOn(await import("~/lib/i18n/init"), "createI18nInstance")
      .mockRejectedValue(new Error("no resources"));

    await expect(prepareI18n("ja")).rejects.toThrow("no resources");
    // 既定で試し直さない (同じ理由で失敗するうえ、失敗を隠すことになる)。
    expect(create).toHaveBeenCalledTimes(1);
  });
});
