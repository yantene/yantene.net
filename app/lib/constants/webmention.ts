/**
 * Webmention の受け口。
 *
 * 受信するルータ (Hono) と、それを広告する `<link rel="webmention">` (ページの meta) の
 * 両方が同じ値を見る必要がある。片方だけ書き換えられると、送り手は広告された先へ投げて
 * 404 を受け取るだけになり、しかもこちら側には何も起きないので気づけない。
 */
export const WEBMENTION_PATH = "/webmention";
