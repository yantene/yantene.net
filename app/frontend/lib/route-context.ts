import { createContext } from "react-router";

/**
 * loader / entry.server が Worker のランタイム値を受け取るためのコンテキストキー。
 *
 * React Router v8 では loader の `context` が `RouterContextProvider` なので、
 * `context.cloudflare` のような直接のプロパティアクセスはできない。値の出し入れは
 * このキー経由で行う (詰めるのは workers/app.ts、取り出すのは各 loader)。
 *
 * 既定値を持たせていないため、詰め忘れると取得時に throw する (fail-loud)。
 */
export const cloudflareContext = createContext<{
  env: Env;
  ctx: ExecutionContext;
}>();

/**
 * secureHeaders が発行した CSP nonce (ADR 0009 / 0011)。
 *
 * development では CSP を付けないため nonce も空になる。空文字を既定値にして
 * その場合も throw させない。
 *
 * コンポーネントツリーへ配るのは React 側の `NonceContext`
 * (`~/frontend/lib/nonce-context`) で、こちらは loader / entry.server が
 * Worker から受け取るための別物。
 */
export const nonceRouteContext = createContext<string>("");
