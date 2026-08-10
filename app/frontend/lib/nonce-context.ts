import { createContext } from "react";

/**
 * secureHeaders が発行した CSP nonce を配る。CSP は script-src に nonce を要求し
 * `'unsafe-inline'` を許可しないため (ADR 0007)、React Router が出す inline script
 * (`<Scripts>` / `<ScrollRestoration>`) には必ずこの値を渡す必要がある。
 */
export const NonceContext = createContext<string>("");
