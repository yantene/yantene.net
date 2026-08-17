import { createContext } from "react-router";
import { defaultLocale, type SupportedLocale } from "~/lib/i18n/locale";

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
 * secureHeaders が発行した CSP nonce (ADR 0007)。
 *
 * development では CSP を付けないため nonce も空になる。空文字を既定値にして
 * その場合も throw させない。
 *
 * コンポーネントツリーへ配るのは React 側の `NonceContext`
 * (`~/frontend/lib/nonce-context`) で、こちらは loader / entry.server が
 * Worker から受け取るための別物。
 */
export const nonceRouteContext = createContext<string>("");

/**
 * このリクエストの表示ロケール。**1 リクエストにつき 1 回だけ決める。**
 *
 * 決めるのは workers/app.ts (Composition Root)。以前はルートの loader 4 つと
 * entry.server が**それぞれ**リクエストのヘッダーを読み直しており、決め方を変えたい
 * ときに 5 か所を回ることになっていた (#313)。
 *
 * 既定値を持たせてあるのは、この道を通らない経路 (テストの直接描画など) で throw
 * させないため。nonce と同じ扱い。
 */
export const localeRouteContext = createContext<SupportedLocale>(defaultLocale);
