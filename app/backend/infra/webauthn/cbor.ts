/**
 * CBOR (RFC 8949) の部分デコーダ。
 *
 * WebAuthn が CBOR を使うのは 2 か所だけで、どちらも形が決まっている。
 *
 * - attestation object — `{ fmt, attStmt, authData }` の map
 * - COSE の公開鍵 — 整数を鍵に持つ map。**長さの前置きが無く**、
 *   attested credential data の末尾に置かれる
 *
 * 後者のために、読み終えた位置を返す形にしてある。位置が分からないと「鍵がどこまでか」
 * を決められず、余りをそのまま受け入れることになる。
 *
 * 汎用のデコーダにはしない。認証器が出さない形 (不定長・タグ・浮動小数) は読めるように
 * せず、出会ったら送出する。読めない形を黙って飛ばすと、飛ばした先の値を検証に使う。
 */

/** CBOR として読める値。map の鍵は整数か文字列に限る。 */
export type CborValue =
  | number
  | Uint8Array
  | string
  | readonly CborValue[]
  | ReadonlyMap<number | string, CborValue>
  | boolean
  | null;

export class CborDecodeError extends Error {
  readonly name = "CborDecodeError";
}

const MAJOR_UNSIGNED = 0;
const MAJOR_NEGATIVE = 1;
const MAJOR_BYTES = 2;
const MAJOR_TEXT = 3;
const MAJOR_ARRAY = 4;
const MAJOR_MAP = 5;
const MAJOR_SIMPLE = 7;

const SIMPLE_FALSE = 20;
const SIMPLE_TRUE = 21;
const SIMPLE_NULL = 22;

const INFO_UINT8 = 24;
const INFO_UINT16 = 25;
const INFO_UINT32 = 26;
const INFO_UINT64 = 27;
const INFO_INDEFINITE = 31;

/** デコードの結果と、その値を読み終えた位置 (次の値の開始位置)。 */
export interface CborRead<T = CborValue> {
  readonly value: T;
  readonly end: number;
}

/**
 * `bytes` の `offset` から 1 つの値を読む。末尾に余りがあっても構わない
 * (COSE の公開鍵のように、途中までが 1 つの値である場合に使う)。
 */
export function decodeCbor(bytes: Uint8Array, offset = 0): CborRead {
  return readValue(bytes, offset, 0);
}

/**
 * `bytes` 全体をちょうど 1 つの値として読む。余りがあれば送出する。
 *
 * attestation object のように「これで全部」と分かっている入力に使う。余りを黙って
 * 捨てると、認識できていない追加のデータを無いものとして扱うことになる。
 */
export function decodeCborExact(bytes: Uint8Array): CborValue {
  const { value, end } = readValue(bytes, 0, 0);
  if (end !== bytes.length) {
    throw new CborDecodeError(`${String(bytes.length - end)} trailing byte(s) after the value`);
  }
  return value;
}

/**
 * 入れ子の深さの上限。認証器が出す CBOR は 3 段も要らない。
 * 深く入れ子にした入力でスタックを溢れさせないために置く。
 */
const MAX_DEPTH = 16;

function readValue(bytes: Uint8Array, offset: number, depth: number): CborRead {
  if (depth > MAX_DEPTH) throw new CborDecodeError("nested too deeply");
  const head = readHead(bytes, offset);
  const { major, info, argument, end } = head;

  switch (major) {
    case MAJOR_UNSIGNED:
      return { value: argument, end };
    case MAJOR_NEGATIVE:
      return { value: -1 - argument, end };
    case MAJOR_BYTES:
      return { value: readSlice(bytes, end, argument), end: end + argument };
    case MAJOR_TEXT:
      return { value: decodeUtf8(readSlice(bytes, end, argument)), end: end + argument };
    case MAJOR_ARRAY:
      return readArray(bytes, end, argument, depth);
    case MAJOR_MAP:
      return readMap(bytes, end, argument, depth);
    case MAJOR_SIMPLE:
      return { value: readSimple(info), end };
    default:
      // major 6 (タグ) はここに落ちる。認証器は出さない。
      throw new CborDecodeError(`unsupported major type ${String(major)}`);
  }
}

interface CborHead {
  readonly major: number;
  readonly info: number;
  readonly argument: number;
  readonly end: number;
}

const BITS_PER_MAJOR = 5;
const INFO_MASK = 0x1f;

function readHead(bytes: Uint8Array, offset: number): CborHead {
  const initial = byteAt(bytes, offset);
  const major = initial >> BITS_PER_MAJOR;
  const info = initial & INFO_MASK;

  if (info < INFO_UINT8) return { major, info, argument: info, end: offset + 1 };
  if (info === INFO_INDEFINITE) {
    // 不定長は認証器が出さない。読めるようにすると、終端記号の扱いという
    // 別の危うさを抱え込むことになる。
    throw new CborDecodeError("indefinite-length items are not supported");
  }

  const width = argumentWidth(info);
  const argument = readUint(bytes, offset + 1, width);
  return { major, info, argument, end: offset + 1 + width };
}

function argumentWidth(info: number): number {
  switch (info) {
    case INFO_UINT8:
      return 1;
    case INFO_UINT16:
      return 2;
    case INFO_UINT32:
      return 4;
    case INFO_UINT64:
      return 8;
    default:
      // 28, 29, 30 は RFC で予約されている。
      throw new CborDecodeError(`reserved additional information ${String(info)}`);
  }
}

const BITS_PER_BYTE = 8;

function readUint(bytes: Uint8Array, offset: number, width: number): number {
  let value = 0;
  for (let index = 0; index < width; index += 1) {
    // 2^53 を越えると桁が落ちる。落ちた値を長さとして使うと、意図しない範囲を読む。
    value = value * (1 << BITS_PER_BYTE) + byteAt(bytes, offset + index);
    if (!Number.isSafeInteger(value)) {
      throw new CborDecodeError("integer is too large to represent exactly");
    }
  }
  return value;
}

function readArray(
  bytes: Uint8Array,
  offset: number,
  length: number,
  depth: number,
): CborRead<readonly CborValue[]> {
  const items: CborValue[] = [];
  let cursor = offset;
  for (let index = 0; index < length; index += 1) {
    const item = readValue(bytes, cursor, depth + 1);
    items.push(item.value);
    cursor = item.end;
  }
  return { value: items, end: cursor };
}

function readMap(
  bytes: Uint8Array,
  offset: number,
  size: number,
  depth: number,
): CborRead<ReadonlyMap<number | string, CborValue>> {
  const entries = new Map<number | string, CborValue>();
  let cursor = offset;
  for (let index = 0; index < size; index += 1) {
    const key = readValue(bytes, cursor, depth + 1);
    if (typeof key.value !== "number" && typeof key.value !== "string") {
      throw new CborDecodeError("map keys must be integers or text strings");
    }
    // 同じ鍵が 2 度出たら送出する。後勝ち・先勝ちのどちらに倒しても、
    // 読む側と書く側で食い違ったときに黙って別の値を使うことになる。
    if (entries.has(key.value)) {
      throw new CborDecodeError(`duplicate map key ${JSON.stringify(key.value)}`);
    }
    const value = readValue(bytes, key.end, depth + 1);
    entries.set(key.value, value.value);
    cursor = value.end;
  }
  return { value: entries, end: cursor };
}

function readSimple(info: number): boolean | null {
  switch (info) {
    case SIMPLE_FALSE:
      return false;
    case SIMPLE_TRUE:
      return true;
    case SIMPLE_NULL:
      return null;
    default:
      // undefined・浮動小数・その他の simple value。認証器は出さない。
      throw new CborDecodeError(`unsupported simple value ${String(info)}`);
  }
}

function byteAt(bytes: Uint8Array, offset: number): number {
  if (offset >= bytes.length) throw new CborDecodeError("unexpected end of input");
  // 上の境界検査を通っているので undefined にはならない。
  return bytes[offset];
}

function readSlice(bytes: Uint8Array, offset: number, length: number): Uint8Array {
  if (offset + length > bytes.length) throw new CborDecodeError("unexpected end of input");
  return bytes.slice(offset, offset + length);
}

function decodeUtf8(bytes: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new CborDecodeError("text string is not valid UTF-8");
  }
}
