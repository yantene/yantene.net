interface StoredValue {
  value: string;
  expirationTtl: number | undefined;
}

/**
 * テスト用の最小 KVNamespace。get (json) / put / delete のみ実装する。
 * 返り値の store で保存内容と期限を直接検証できる。
 *
 * 期限切れは模擬しない。TTL を過ぎたキーは KV 側が消すので、こちらで再現しても
 * 確かめられるのは自作の時計だけになる。
 */
export function createTestKv(): {
  kv: KVNamespace;
  store: Map<string, StoredValue>;
} {
  const store = new Map<string, StoredValue>();

  const kv = {
    get: (key: string, type?: string) => {
      const found = store.get(key);
      if (found === undefined) return Promise.resolve(null);
      return Promise.resolve(type === "json" ? JSON.parse(found.value) : found.value);
    },
    put: (key: string, value: string, options?: { expirationTtl?: number }) => {
      store.set(key, { value, expirationTtl: options?.expirationTtl });
      return Promise.resolve();
    },
    delete: (key: string) => {
      store.delete(key);
      return Promise.resolve();
    },
  } as unknown as KVNamespace;

  return { kv, store };
}
