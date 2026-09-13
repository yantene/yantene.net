import { describe, expect, it } from "vitest";
import { fromBase64Url, InvalidBase64UrlError, toBase64Url } from "./base64url";

describe("toBase64Url", () => {
  it("詰め物を付けない", () => {
    expect(toBase64Url(new Uint8Array([1]))).toBe("AQ");
    expect(toBase64Url(new Uint8Array([1, 2]))).toBe("AQI");
    expect(toBase64Url(new Uint8Array([1, 2, 3]))).toBe("AQID");
  });

  it("URL に出せない文字を使わない", () => {
    // 0xFB 0xFF 0xBF は標準 base64 で "+/+/" を含む並び。
    const encoded = toBase64Url(new Uint8Array([0xfb, 0xff, 0xbf, 0xfb, 0xff, 0xbf]));
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it("空のバイト列は空文字になる", () => {
    expect(toBase64Url(new Uint8Array())).toBe("");
  });

  it("長いバイト列でも落ちない", () => {
    const bytes = new Uint8Array(200_000).fill(0x41);
    expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
  });
});

describe("fromBase64Url", () => {
  it("詰め物の有無どちらでも読める", () => {
    expect(fromBase64Url("AQI")).toEqual(new Uint8Array([1, 2]));
    expect(fromBase64Url("AQI=")).toEqual(new Uint8Array([1, 2]));
  });

  it("往復しても変わらない", () => {
    const bytes = crypto.getRandomValues(new Uint8Array(64));
    expect(fromBase64Url(toBase64Url(bytes))).toEqual(bytes);
  });

  it("base64url でない文字は空に倒さず送出する", () => {
    expect(() => fromBase64Url("AQ+I")).toThrow(InvalidBase64UrlError);
    expect(() => fromBase64Url("AQ/I")).toThrow(InvalidBase64UrlError);
    expect(() => fromBase64Url("あ")).toThrow(InvalidBase64UrlError);
  });

  it("長さの合わない値は送出する", () => {
    expect(() => fromBase64Url("A")).toThrow(InvalidBase64UrlError);
  });
});
