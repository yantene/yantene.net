/**
 * 画像バイナリのヘッダーから寸法を読む。
 *
 * refresh 時に MDAST の image ノードへ width/height を埋め、レイアウトシフトを防ぐために使う。
 * 画像全体をデコードせずヘッダーだけを見るので Workers 上でも安価。
 *
 * 判別できない形式・壊れたヘッダー・寸法 0 では undefined を返す。呼び出し側は
 * 属性を付けない (誤った寸法で静かに見た目を壊すより、付けないほうが安全)。
 */
export interface ImageDimensions {
  readonly width: number;
  readonly height: number;
}

/** PNG シグネチャ (89 50 4E 47 0D 0A 1A 0A)。 */
const pngSignature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

/** JPEG の SOF マーカー範囲と、その中で SOF ではないもの (DHT / JPG / DAC)。 */
const sofMarkerMin = 0xc0;
const sofMarkerMax = 0xcf;
const nonSofMarkers = new Set([0xc4, 0xc8, 0xcc]);

/** VP8L / VP8 が使う 14 bit のマスク。 */
const mask14Bit = 0x3f_ff;

function hasPrefix(bytes: Uint8Array, prefix: readonly number[]): boolean {
  if (bytes.length < prefix.length) return false;
  return prefix.every((value, index) => bytes.at(index) === value);
}

/** ASCII のみのマーカー文字列 ("IHDR" 等) との一致を見る。 */
function hasAsciiAt(bytes: Uint8Array, offset: number, text: string): boolean {
  if (bytes.length < offset + text.length) return false;
  for (let i = 0; i < text.length; i += 1) {
    if (bytes.at(offset + i) !== text.codePointAt(i)) return false;
  }
  return true;
}

/** 寸法として妥当なら返す。0 や NaN は「読めなかった」として扱う。 */
function toDimensions(
  width: number,
  height: number,
): ImageDimensions | undefined {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return undefined;
  if (width <= 0 || height <= 0) return undefined;
  return { width, height };
}

/** PNG: IHDR チャンクの先頭 8 バイトが幅・高さ (big-endian 32bit)。 */
function readPng(
  view: DataView,
  bytes: Uint8Array,
): ImageDimensions | undefined {
  // シグネチャ(8) + 長さ(4) + "IHDR"(4) + 幅(4) + 高さ(4)
  if (bytes.length < 24) return undefined;
  if (!hasAsciiAt(bytes, 12, "IHDR")) return undefined;
  return toDimensions(view.getUint32(16), view.getUint32(20));
}

/**
 * JPEG: SOI の後ろのセグメントを辿り、最初の SOF マーカーから読む。
 * SOF のペイロードは [精度(1), 高さ(2), 幅(2), ...]。
 */
function readJpeg(
  view: DataView,
  bytes: Uint8Array,
): ImageDimensions | undefined {
  let offset = 2; // SOI の次から
  while (offset + 3 < bytes.length) {
    if (bytes.at(offset) !== 0xff) {
      offset += 1; // パディング等を読み飛ばす
      continue;
    }
    const marker = bytes.at(offset + 1) ?? 0;
    // スタンドアロンマーカー (長さフィールドを持たない)
    const isStandalone =
      marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7);
    if (isStandalone) {
      offset += 2;
      continue;
    }
    const length = view.getUint16(offset + 2);
    const isSof =
      marker >= sofMarkerMin &&
      marker <= sofMarkerMax &&
      !nonSofMarkers.has(marker);
    if (isSof) {
      // マーカー(2) + 長さ(2) + 精度(1) → 高さ, 幅
      if (offset + 9 > bytes.length) return undefined;
      return toDimensions(
        view.getUint16(offset + 7),
        view.getUint16(offset + 5),
      );
    }
    if (length < 2) return undefined; // 壊れた長さ (無限ループ防止)
    offset += 2 + length;
  }
  return undefined;
}

/** GIF: "GIF87a" / "GIF89a" の直後が幅・高さ (little-endian 16bit)。 */
function readGif(
  view: DataView,
  bytes: Uint8Array,
): ImageDimensions | undefined {
  if (bytes.length < 10) return undefined;
  return toDimensions(view.getUint16(6, true), view.getUint16(8, true));
}

/**
 * WebP: RIFF コンテナ。VP8 (lossy) / VP8L (lossless) / VP8X (extended) で
 * 寸法の位置と符号化が異なる。
 */
function readWebp(
  view: DataView,
  bytes: Uint8Array,
): ImageDimensions | undefined {
  if (bytes.length < 30) return undefined;
  if (hasAsciiAt(bytes, 12, "VP8X")) {
    // 24bit little-endian の「実寸 - 1」
    const width = 1 + view.getUint16(24, true) + ((bytes.at(26) ?? 0) << 16);
    const height = 1 + view.getUint16(27, true) + ((bytes.at(29) ?? 0) << 16);
    return toDimensions(width, height);
  }
  if (hasAsciiAt(bytes, 12, "VP8L")) {
    // 1 バイトのシグネチャ(0x2f) の後、14bit ずつの「実寸 - 1」
    const bits = view.getUint32(21, true);
    return toDimensions(1 + (bits & mask14Bit), 1 + ((bits >> 14) & mask14Bit));
  }
  if (hasAsciiAt(bytes, 12, "VP8 ")) {
    // フレームタグ(3) + シンクコード(3) の後に 16bit ずつ (上位 2bit はスケール)
    return toDimensions(
      view.getUint16(26, true) & mask14Bit,
      view.getUint16(28, true) & mask14Bit,
    );
  }
  return undefined;
}

export function readImageDimensions(
  bytes: Uint8Array,
): ImageDimensions | undefined {
  if (bytes.length < 10) return undefined;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  if (hasPrefix(bytes, pngSignature)) return readPng(view, bytes);
  if (bytes.at(0) === 0xff && bytes.at(1) === 0xd8)
    return readJpeg(view, bytes);
  if (hasAsciiAt(bytes, 0, "GIF8")) return readGif(view, bytes);
  if (hasAsciiAt(bytes, 0, "RIFF") && hasAsciiAt(bytes, 8, "WEBP")) {
    return readWebp(view, bytes);
  }
  return undefined;
}
