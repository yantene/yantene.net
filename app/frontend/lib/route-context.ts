import { createContext } from "react-router";

/**
 * loader / entry.server が Worker のランタイム値を受け取るためのコンテキストキー。
 *
 * `future.v8_middleware` を有効にすると loader の `context` は
 * `RouterContextProvider` になり、`context.cloudflare` のような直接のプロパティ
 * アクセスができない。値の出し入れはこのキー経由で行う (設定側は workers/app.ts)。
 */
export const cloudflareContext = createContext<{
  env: Env;
  ctx: ExecutionContext;
}>();

/** secureHeaders が発行した CSP nonce (ADR 0009 / 0011)。 */
export const nonceContext = createContext<string>("");
