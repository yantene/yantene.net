import { describe, expect, it } from "vitest";
import { readImageDimensions } from "./image-dimensions";

/** PNG: シグネチャ + IHDR (幅・高さは big-endian 32bit)。 */
function pngOf(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(24);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  const view = new DataView(bytes.buffer);
  view.setUint32(8, 13); // IHDR length
  bytes.set([0x49, 0x48, 0x44, 0x52], 12); // "IHDR"
  view.setUint32(16, width);
  view.setUint32(20, height);
  return bytes;
}

/**
 * JPEG: SOI + 任意のセグメント + SOF0。
 * SOF のペイロードは [精度, 高さ(2), 幅(2), ...] の順。
 */
function jpegOf(
  width: number,
  height: number,
  { marker = 0xc0 }: { marker?: number } = {},
): Uint8Array {
  const head = [0xff, 0xd8];
  // 先にダミーの APP0 を挟み、マーカー走査が必要な形にする。
  const app0 = [0xff, 0xe0, 0x00, 0x04, 0x00, 0x00];
  const sof = [
    0xff,
    marker,
    0x00,
    0x11,
    0x08,
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
  ];
  return new Uint8Array([...head, ...app0, ...sof]);
}

/** GIF: "GIF89a" + 幅・高さ (little-endian 16bit)。 */
function gifOf(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(10);
  bytes.set([0x47, 0x49, 0x46, 0x38, 0x39, 0x61], 0);
  new DataView(bytes.buffer).setUint16(6, width, true);
  new DataView(bytes.buffer).setUint16(8, height, true);
  return bytes;
}

describe("readImageDimensions", () => {
  it("reads PNG dimensions", () => {
    expect(readImageDimensions(pngOf(1280, 720))).toEqual({
      width: 1280,
      height: 720,
    });
  });

  it("reads JPEG dimensions by scanning to the SOF marker", () => {
    expect(readImageDimensions(jpegOf(4032, 3024))).toEqual({
      width: 4032,
      height: 3024,
    });
  });

  it("reads JPEG variants (progressive SOF2)", () => {
    expect(readImageDimensions(jpegOf(800, 600, { marker: 0xc2 }))).toEqual({
      width: 800,
      height: 600,
    });
  });

  it("reads GIF dimensions", () => {
    expect(readImageDimensions(gifOf(320, 240))).toEqual({
      width: 320,
      height: 240,
    });
  });

  /*
   * 寸法が取れないものは undefined を返す (呼び出し側は属性を付けない)。
   * 誤った寸法を付けて静かに見た目を壊すより、付けないほうが安全。
   */
  it("returns undefined for unknown or truncated data", () => {
    expect(readImageDimensions(new Uint8Array())).toBeUndefined();
    expect(readImageDimensions(new Uint8Array([0x00, 0x01, 0x02]))).toBeUndefined();
    // PNG シグネチャだけで IHDR が無い
    expect(
      readImageDimensions(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    ).toBeUndefined();
    // JPEG SOI のみ (SOF が現れない)
    expect(readImageDimensions(new Uint8Array([0xff, 0xd8]))).toBeUndefined();
  });

  it("returns undefined when a dimension is zero", () => {
    expect(readImageDimensions(pngOf(0, 100))).toBeUndefined();
  });
});
