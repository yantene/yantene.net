/**
 * ECDSA の署名を DER (ASN.1) から Web Crypto の raw 形式に直す。
 *
 * WebAuthn は ES256 の署名を DER の `SEQUENCE { r INTEGER, s INTEGER }` で運ぶが
 * (WebAuthn §6.5.6)、`crypto.subtle.verify` が受けるのは `r || s` を固定長で並べた
 * raw 形式。
 *
 * **DER の整数は最小の長さで書かれる。** 値が 2^248 未満なら 32 バイトに満たず、
 * 先頭のビットが立っていれば 0x00 が 1 バイト前置される。つまり `r` も `s` も
 * 31 / 32 / 33 バイトのどれにもなる。長さを 32 と 33 の 2 通りに決め打ちすると、
 * **約 1/128 の署名で読み違えて検証に落ちる**。
 */

/** DER として読めない署名を渡された。 */
export class DerSignatureError extends Error {
  readonly name = "DerSignatureError";
}

const TAG_SEQUENCE = 0x30;
const TAG_INTEGER = 0x02;
const LONG_FORM = 0x80;

/** P-256 の r / s の長さ。ES256 の raw 署名はこれを 2 つ並べた 64 バイト。 */
export const P256_COORDINATE_BYTES = 32;

/**
 * DER の ECDSA 署名を `r || s` (各 `size` バイト) に直す。
 *
 * @param size 曲線 1 座標ぶんのバイト数 (P-256 なら 32)
 */
export function derToRawEcdsaSignature(
  der: Uint8Array,
  size: number = P256_COORDINATE_BYTES,
): Uint8Array<ArrayBuffer> {
  const sequence = readTagged(der, 0, TAG_SEQUENCE);
  if (sequence.end !== der.length) {
    throw new DerSignatureError("trailing bytes after the signature sequence");
  }

  const r = readTagged(der, sequence.contentStart, TAG_INTEGER);
  const s = readTagged(der, r.end, TAG_INTEGER);
  if (s.end !== sequence.end) {
    throw new DerSignatureError("trailing bytes inside the signature sequence");
  }

  const raw = new Uint8Array(size * 2);
  raw.set(toFixedWidth(der.subarray(r.contentStart, r.end), size), 0);
  raw.set(toFixedWidth(der.subarray(s.contentStart, s.end), size), size);
  return raw;
}

interface TaggedValue {
  /** 中身が始まる位置。 */
  readonly contentStart: number;
  /** 中身が終わる位置 (次の値の開始位置)。 */
  readonly end: number;
}

function readTagged(der: Uint8Array, offset: number, tag: number): TaggedValue {
  if (byteAt(der, offset) !== tag) {
    throw new DerSignatureError(`expected tag 0x${tag.toString(16)} at offset ${String(offset)}`);
  }
  const { length, headerEnd } = readLength(der, offset + 1);
  const end = headerEnd + length;
  if (end > der.length) throw new DerSignatureError("length runs past the end of the input");
  return { contentStart: headerEnd, end };
}

function readLength(der: Uint8Array, offset: number): { length: number; headerEnd: number } {
  const first = byteAt(der, offset);
  if ((first & LONG_FORM) === 0) return { length: first, headerEnd: offset + 1 };

  // 長形式。P-256 の署名は短形式に収まるが、曲線が大きくなれば要る。
  const width = first & (LONG_FORM - 1);
  if (width === 0) throw new DerSignatureError("indefinite length is not allowed in DER");
  if (width > 4) throw new DerSignatureError("length field is implausibly wide");
  let length = 0;
  for (let index = 0; index < width; index += 1) {
    length = (length << 8) | byteAt(der, offset + 1 + index);
  }
  return { length, headerEnd: offset + 1 + width };
}

/**
 * DER の整数の中身を、左を 0 で詰めた固定長に直す。
 *
 * DER は最小の長さで書くので、先頭の 0x00 は「符号ビットを立てないための詰め物」で
 * あって値の一部ではない。落としてから詰め直す。
 */
function toFixedWidth(value: Uint8Array, size: number): Uint8Array {
  let start = 0;
  while (start < value.length - 1 && value[start] === 0) start += 1;
  const significant = value.subarray(start);
  if (significant.length > size) {
    throw new DerSignatureError(
      `integer is ${String(significant.length)} bytes, wider than the ${String(size)}-byte curve`,
    );
  }
  const padded = new Uint8Array(size);
  padded.set(significant, size - significant.length);
  return padded;
}

function byteAt(der: Uint8Array, offset: number): number {
  if (offset >= der.length) throw new DerSignatureError("unexpected end of signature");
  return der[offset];
}
