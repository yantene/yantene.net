#!/usr/bin/env node
/**
 * デプロイ後スモーク。主要な公開 URL を叩き、5xx (サーバーエラー) が無いかを確認する。
 * rootView / layout / middleware / entry.server 等、全ページ共通の描画経路や env / binding
 * 起因の実行時回帰を、単体テストが見られない実環境で検知するための最終確認。
 *
 * 使い方:
 *   SMOKE_BASE=https://staging.yantene.net \
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

/**
 * 各ページ種別を 1 つずつ + 主要な公開エンドポイント。
 *
 * 文字列は「5xx でなければ ok」の確認。オブジェクトを書くと `headers` を足したうえで
 * `expectContentType` (前方一致) まで確かめる。
 */
const targets = [
  "/",
  "/notes",
  "/notes/does-not-exist",
  /*
   * 記事 URL は Accept 次第で HTML と原文 Markdown に分かれる (ADR 0020)。取り違えは
   * 5xx にならないので、両分岐の Content-Type を名指しで確かめる。存在しない slug でも
   * 分岐は同じところを通るため、実在の slug を知らなくても検知できる。
   */
  {
    label: "/notes/does-not-exist (browser Accept)",
    path: "/notes/does-not-exist",
    headers: {
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    expectContentType: "text/html",
  },
  {
    label: "/notes/does-not-exist (Accept: text/markdown)",
    path: "/notes/does-not-exist",
    headers: { Accept: "text/markdown" },
    expectContentType: "application/problem+json",
  },
  "/feed.xml",
  "/sitemap.xml",
  "/robots.txt",
  "/og/default",
];

/** 文字列指定と詳細指定を 1 つの形に均す。 */
const paths = targets.map((target) =>
  typeof target === "string"
    ? { label: target, path: target, headers: {} }
    : { headers: {}, ...target },
);

let failed = 0;
let blockedByAuth = 0;
for (const { label, path, headers, expectContentType } of paths) {
  let status = 0;
  let contentType = "";
  try {
    const res = await fetch(`${base}${path}`, {
      headers: { ...authHeader, ...headers },
      redirect: "manual",
    });
    status = res.status;
    contentType = res.headers.get("content-type") ?? "";
  } catch (error) {
    console.log(`x ERR ${label} (${error.message})`);
    failed += 1;
    continue;
  }
  // 401/403 はアプリのハンドラまで到達していないということ。500 未満だからと
  // 成功に数えると、BASIC 認証の壁で止まったまま「全部 ok」になってしまう。
  const isBlocked = status === 401 || status === 403;
  const isWrongType =
    expectContentType !== undefined &&
    !contentType.startsWith(expectContentType);
  const isOk = status < 500 && !isBlocked && !isWrongType;
  if (!isOk) failed += 1;
  if (isBlocked) blockedByAuth += 1;
  console.log(`${isOk ? "ok" : "x "} ${status} ${label}`);
  if (isWrongType) {
    console.log(
      `     expected content-type ${expectContentType}, got ${contentType}`,
    );
  }
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
  `\nok all ${paths.length} checks reached the app and responded as expected`,
);
