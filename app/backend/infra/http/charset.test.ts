import { describe, expect, it } from "vitest";
import { charsetOf, decoderFor } from "./charset";

describe("charsetOf", () => {
  it("Content-Type が名乗る文字コードを読む", () => {
    expect(charsetOf("text/html; charset=Shift_JIS")).toBe("Shift_JIS");
  });

  it("引用符で括られていても読む", () => {
    expect(charsetOf('text/html; charset="euc-jp"')).toBe("euc-jp");
  });

  it("後ろに別のパラメータが続いても文字コードだけを採る", () => {
    expect(charsetOf("text/html; charset=euc-jp; boundary=x")).toBe("euc-jp");
  });

  it("名乗りが無ければ UTF-8 とみなす", () => {
    expect(charsetOf("text/html")).toBe("utf8");
  });

  /* Content-Type ヘッダー自体が無い相手も居る (headers.get は null を返す)。 */
  it("Content-Type が無ければ UTF-8 とみなす", () => {
    expect(charsetOf(null)).toBe("utf8");
  });
});

describe("decoderFor", () => {
  /*
   * 日本語圏の個人サイトには Shift_JIS や EUC-JP のページが残っている。決め打ちで
   * UTF-8 にすると、題も本文も文字化けする。
   */
  it("Shift_JIS のバイト列を復号する", () => {
    // "あ" (Shift_JIS) = 0x82 0xA0
    expect(decoderFor("Shift_JIS").decode(new Uint8Array([0x82, 0xa0]))).toBe(
      "あ",
    );
  });

  it("知らない文字コードなら UTF-8 に倒す", () => {
    // "あ" (UTF-8) = 0xE3 0x81 0x82
    const bytes = new Uint8Array([0xe3, 0x81, 0x82]);

    expect(decoderFor("x-nonexistent").decode(bytes)).toBe("あ");
  });
});
