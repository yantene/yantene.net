import { describe, expect, it } from "vitest";
import { charsetFor, charsetFromMeta, charsetOf, decoderFor } from "./charset";

const utf8 = new TextEncoder();

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

  it("名乗りが無ければ undefined", () => {
    expect(charsetOf("text/html")).toBeUndefined();
  });

  /* Content-Type ヘッダー自体が無い相手も居る (headers.get は null を返す)。 */
  it("Content-Type が無ければ undefined", () => {
    expect(charsetOf(null)).toBeUndefined();
  });
});

describe("charsetFromMeta", () => {
  it("meta charset を読む", () => {
    const html = utf8.encode('<html><head><meta charset="Shift_JIS">');

    expect(charsetFromMeta(html)).toBe("Shift_JIS");
  });

  it("引用符が無くても読む", () => {
    expect(charsetFromMeta(utf8.encode("<meta charset=euc-jp>"))).toBe("euc-jp");
  });

  it("http-equiv の書き方も読む", () => {
    const html = utf8.encode(
      '<meta http-equiv="Content-Type" content="text/html; charset=EUC-JP">',
    );

    expect(charsetFromMeta(html)).toBe("EUC-JP");
  });

  it("charset を名乗らない meta は読み飛ばす", () => {
    const html = utf8.encode(
      '<meta name="viewport" content="width=device-width"><meta charset="Shift_JIS">',
    );

    expect(charsetFromMeta(html)).toBe("Shift_JIS");
  });

  it("宣言が無ければ undefined", () => {
    expect(charsetFromMeta(utf8.encode("<html><head><title>x"))).toBeUndefined();
  });

  /*
   * 仕様が宣言を先頭 1024 バイト以内に求めているので、こちらもそこまでしか見ない。
   * 全体を走査すると、本文に書かれた文字列を宣言と読み違える。
   */
  it("先頭 1024 バイトより後ろの宣言は見ない", () => {
    const html = utf8.encode(`<html><head>${" ".repeat(1024)}<meta charset="Shift_JIS">`);

    expect(charsetFromMeta(html)).toBeUndefined();
  });

  /*
   * 宣言を探す窓は latin1 として読む。UTF-8 として読むと、Shift_JIS の本文にある
   * 壊れた並びが後続のバイトごと置換文字に畳まれ、タグの綴りが崩れることがある。
   */
  it("本文が UTF-8 でないページでも宣言を読める", () => {
    // "あ" (Shift_JIS) = 0x82 0xA0 を挟んでから宣言を書く。
    const html = new Uint8Array([
      ...utf8.encode("<title>"),
      0x82,
      0xa0,
      ...utf8.encode('</title><meta charset="Shift_JIS">'),
    ]);

    expect(charsetFromMeta(html)).toBe("Shift_JIS");
  });
});

describe("charsetFor", () => {
  it("Content-Type が名乗っていればそれを採る", () => {
    const html = utf8.encode('<meta charset="euc-jp">');

    expect(charsetFor("text/html; charset=Shift_JIS", html)).toBe("Shift_JIS");
  });

  it("Content-Type が名乗らなければ meta を見る", () => {
    const html = utf8.encode('<meta charset="Shift_JIS">');

    expect(charsetFor("text/html", html)).toBe("Shift_JIS");
  });

  it("どちらも名乗らなければ undefined (= UTF-8 に倒す)", () => {
    expect(charsetFor("text/html", utf8.encode("<html>"))).toBeUndefined();
  });
});

describe("decoderFor", () => {
  /*
   * 日本語圏の個人サイトには Shift_JIS や EUC-JP のページが残っている。決め打ちで
   * UTF-8 にすると、題も本文も文字化けする。
   */
  it("Shift_JIS のバイト列を復号する", () => {
    // "あ" (Shift_JIS) = 0x82 0xA0
    expect(decoderFor("Shift_JIS").decode(new Uint8Array([0x82, 0xa0]))).toBe("あ");
  });

  it("知らない文字コードなら UTF-8 に倒す", () => {
    // "あ" (UTF-8) = 0xE3 0x81 0x82
    const bytes = new Uint8Array([0xe3, 0x81, 0x82]);

    expect(decoderFor("x-nonexistent").decode(bytes)).toBe("あ");
  });

  it("名乗りが無ければ UTF-8 に倒す", () => {
    const bytes = new Uint8Array([0xe3, 0x81, 0x82]);

    expect(decoderFor(undefined).decode(bytes)).toBe("あ");
  });
});
