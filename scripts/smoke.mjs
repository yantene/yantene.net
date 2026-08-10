#!/usr/bin/env node
/**
 * デプロイ後スモーク。主要な公開 URL を叩き、5xx (サーバーエラー) が無いかを確認する。
 * rootView / layout / middleware / entry.server 等、全ページ共通の描画経路や env / binding
 * 起因の実行時回帰を、単体テストが見られない実環境で検知するための最終確認。
 *
 * 使い方:
 *   SMOKE_BASE=https://yantene-staging.yantene.workers.dev \
 *   SMOKE_USER=<user> SMOKE_PASS=<pass> pnpm run smoke
 *
 * BASIC 認証が無い環境 (production) では SMOKE_USER / SMOKE_PASS を省略する。
 */
import { Buffer } from "node:buffer";

const base = process.env.SMOKE_BASE ?? process.argv[2];
if (base === undefined || base.length === 0) {
  console.error("usage: SMOKE_BASE=<url> node scripts/smoke.mjs");
  process.exit(2);
}

const user = process.env.SMOKE_USER;
const pass = process.env.SMOKE_PASS;
let authHeader = {};
if (user !== undefined && pass !== undefined) {
  // eslint-disable-next-line unicorn/prefer-uint8array-base64 -- Uint8Array#toBase64 は Node 24.18 に未実装。
  const encoded = Buffer.from(`${user}:${pass}`).toString("base64");
  authHeader = { Authorization: `Basic ${encoded}` };
}

/** 各ページ種別を 1 つずつ + 主要な公開エンドポイント。 */
const paths = [
  "/",
  "/notes",
  "/notes/does-not-exist",
  "/feed.xml",
  "/sitemap.xml",
  "/robots.txt",
  "/og/default",
];

let failed = 0;
let blockedByAuth = 0;
for (const path of paths) {
  let status = 0;
  try {
    const res = await fetch(`${base}${path}`, {
      headers: authHeader,
      redirect: "manual",
    });
    status = res.status;
  } catch (error) {
    console.log(`x ERR ${path} (${error.message})`);
    failed += 1;
    continue;
  }
  // 401/403 はアプリのハンドラまで到達していないということ。500 未満だからと
  // 成功に数えると、BASIC 認証の壁で止まったまま「全部 ok」になってしまう。
  const isBlocked = status === 401 || status === 403;
  const isOk = status < 500 && !isBlocked;
  if (!isOk) failed += 1;
  if (isBlocked) blockedByAuth += 1;
  console.log(`${isOk ? "ok" : "x "} ${status} ${path}`);
}

if (blockedByAuth > 0) {
  console.error(
    `\nx ${blockedByAuth} path(s) were blocked before reaching the app (401/403).`,
  );
  console.error(
    authHeader.Authorization === undefined
      ? "  BASIC 認証のある環境には SMOKE_USER / SMOKE_PASS を渡すこと。"
      : "  SMOKE_USER / SMOKE_PASS が誤っている可能性がある。",
  );
}
if (failed > 0) {
  console.error(`\nx ${failed} path(s) failed`);
  process.exit(1);
}
console.log(
  `\nok all ${paths.length} paths reached the app and responded < 500`,
);
