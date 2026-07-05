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
export function createTestR2(): {
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
    list: (options?: { prefix?: string }) => {
      const prefix = options?.prefix ?? "";
      const objects: { key: string }[] = [];
      for (const key of store.keys()) {
        if (key.startsWith(prefix)) objects.push({ key });
      }
      return Promise.resolve({ objects, truncated: false });
    },
    delete: (keys: string | string[]) => {
      const keyList = Array.isArray(keys) ? keys : [keys];
      for (const key of keyList) store.delete(key);
      return Promise.resolve();
    },
  } as unknown as R2Bucket;

  return { bucket, store };
}
