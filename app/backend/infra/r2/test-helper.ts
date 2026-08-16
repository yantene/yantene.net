interface StoredObject {
  bytes: Uint8Array;
  contentType: string | undefined;
}

function toBytes(value: string | ArrayBuffer | ArrayBufferView): Uint8Array {
  if (typeof value === "string") return new TextEncoder().encode(value);
  return new Uint8Array(value instanceof ArrayBuffer ? value : value.buffer);
}

/**
 * テスト用の最小 in-memory R2Bucket。get / put / list / delete のみ実装する。
 * 返り値の store で保存内容を直接検証できる。
 */
/**
 * 符号単位の順。
 *
 * R2 は鍵をこの順に返す。上の再開判定が `>` (符号単位の比較) なので、並べ方も揃えて
 * おかないと非 ASCII の鍵で食い違い、頁をまたぐ掃除が取りこぼす。localeCompare は
 * 使えない。
 */
function byCodeUnit(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/**
 * テスト用の R2。
 *
 * @param pageSize list が 1 回に返す件数。既定は 1 頁に収まる大きさ。小さくすると
 *   cursor を辿る実装かどうかを確かめられる。
 */
export function createTestR2(pageSize = Infinity): {
  bucket: R2Bucket;
  store: Map<string, StoredObject>;
} {
  const store = new Map<string, StoredObject>();

  const bucket = {
    put: (
      key: string,
      value: string | ArrayBuffer | ArrayBufferView,
      options?: { httpMetadata?: { contentType?: string } },
    ) => {
      store.set(key, {
        bytes: toBytes(value),
        contentType: options?.httpMetadata?.contentType,
      });
      return Promise.resolve();
    },
    get: (key: string) => {
      const found = store.get(key);
      if (found === undefined) return Promise.resolve(null);
      return Promise.resolve({
        text: () => Promise.resolve(new TextDecoder().decode(found.bytes)),
        arrayBuffer: () =>
          Promise.resolve(
            found.bytes.buffer.slice(
              found.bytes.byteOffset,
              found.bytes.byteOffset + found.bytes.byteLength,
            ),
          ),
        httpMetadata: { contentType: found.contentType },
      });
    },
    /*
     * 頁に分けて返す。cursor は**最後に返した鍵**で、再開はその次から
     * (本物の R2 と同じ)。件数で数える作りにすると、列挙しながら消したときに位置が
     * ずれて取りこぼすので、そこを模しておかないと掃除の実装を確かめたことにならない。
     *
     * pageSize は createTestR2 の引数で決める (既定は 1 頁に収める)。
     */
    list: (options?: { prefix?: string; cursor?: string }) => {
      const prefix = options?.prefix ?? "";
      const after = options?.cursor;
      const rest: string[] = [];
      for (const key of store.keys()) {
        if (!key.startsWith(prefix)) continue;
        if (after !== undefined && key <= after) continue;
        rest.push(key);
      }
      rest.sort(byCodeUnit);
      const page = rest.slice(0, pageSize);
      return Promise.resolve({
        objects: page.map((key) => ({ key })),
        truncated: page.length < rest.length,
        cursor: page.at(-1),
      });
    },
    delete: (keys: string | string[]) => {
      const keyList = Array.isArray(keys) ? keys : [keys];
      for (const key of keyList) store.delete(key);
      return Promise.resolve();
    },
  } as unknown as R2Bucket;

  return { bucket, store };
}
