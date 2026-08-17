import { describe, expect, it } from "vitest";
import { truncateByGrapheme } from "./truncate";

describe("truncateByGrapheme", () => {
  it("上限に収まっていればそのまま返す", () => {
    expect(truncateByGrapheme("あいう", 3)).toBe("あいう");
    expect(truncateByGrapheme("", 3)).toBe("");
  });

  it("上限を越えたら切る", () => {
    expect(truncateByGrapheme("あいうえお", 3)).toBe("あいう");
  });

  /*
   * 切り口がちょうど絵文字に当たったときだけ壊れるので、当たる位置を狙って置く。
   * UTF-16 で切ると上位サロゲートだけが残り、豆腐になる (#300)。
   */
  it("サロゲートペアを割らない", () => {
    const value = `${"あ".repeat(59)}🎉`;

    const truncated = truncateByGrapheme(value, 60);

    expect(truncated).toBe(`${"あ".repeat(59)}🎉`);
    // 片割れが残っていないこと。割れていれば U+D83C で終わる。
    expect(truncated.at(-1)?.codePointAt(0)).not.toBe(0xd8_3c);
  });

  it("符号単位で切ると割れる位置でも割らない", () => {
    // 「あ」59 個 + 🎉 は UTF-16 で 61 単位。60 で切ると絵文字の途中に当たる。
    const value = `${"あ".repeat(59)}🎉`;
    expect(value).toHaveLength(61);

    // 書記素では 60 個ちょうどなので、切り詰めは起きない。
    expect(truncateByGrapheme(value, 60)).toBe(value);
    // 59 まで詰めれば絵文字ごと落ちる。半分だけ残さない。
    expect(truncateByGrapheme(value, 59)).toBe("あ".repeat(59));
  });

  it("結合した絵文字をばらさない", () => {
    // 家族の絵文字は ZWJ で 4 つの人が繋がっていて、UTF-16 では 11 単位ある。
    const family = "👨‍👩‍👧‍👦";
    expect(family).toHaveLength(11);

    expect(truncateByGrapheme(`${family}あ`, 1)).toBe(family);
    expect(truncateByGrapheme(`あ${family}`, 1)).toBe("あ");
  });

  it("異体字選択子を切り離さない", () => {
    const variant = "葛︀";

    expect(truncateByGrapheme(`${variant}あ`, 1)).toBe(variant);
  });

  describe("ellipsis", () => {
    it("切り詰めたときだけ足す", () => {
      expect(truncateByGrapheme("あいうえお", 3, { ellipsis: "…" })).toBe(
        "あい…",
      );
      expect(truncateByGrapheme("あいう", 3, { ellipsis: "…" })).toBe("あいう");
    });

    it("足すものを含めて上限を守る", () => {
      // 3 文字の記号を足しても、返るのは上限の 4 書記素まで。
      expect(truncateByGrapheme("あいうえお", 4, { ellipsis: "..." })).toBe(
        "あ...",
      );
    });

    it("足すものだけで上限に届くなら本文は残らない", () => {
      expect(truncateByGrapheme("あいうえお", 1, { ellipsis: "…" })).toBe("…");
    });
  });
});
