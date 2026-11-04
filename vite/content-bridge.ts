import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

/**
 * 手元のコンテンツリポジトリの作業ツリーを、dev サーバーの HTTP で Worker に渡す (ADR 0047)。
 *
 * Worker (workerd) からホストのファイルは読めない。`node:fs` の import は通るが、映っているのは
 * 仮想のファイルシステムで、手元のファイルは見えない。そこで Node で動く Vite の側が読み、
 * `LocalContentStore` が fetch で受け取る。
 *
 * ```
 * GET /__content/tree            → { entries: [{ path, hash }] }
 * GET /__content/file?path=<path> → 生バイト列 (無ければ 404)
 * ```
 */
export const CONTENT_BRIDGE_PATH = "/__content";

/**
 * git の blob ハッシュ (`sha1("blob <len>\0" + bytes)`)。
 *
 * Artifacts の tree が返すハッシュと同じ値なので、`local` と `artifacts` を切り替えても
 * D1 の contentHash による変更検出がそのまま効く (コミット済みで手を入れていないファイルは
 * 読み直されない)。
 */
export function gitBlobHash(bytes: Uint8Array): string {
  return createHash("sha1")
    .update(`blob ${String(bytes.byteLength)}\0`)
    .update(bytes)
    .digest("hex");
}

/**
 * 作業ツリーのうち、push すれば載るファイルを列挙する。
 *
 * `git ls-files --cached --others --exclude-standard` を使う。コミットしていない新しい記事も
 * 入り、`.gitignore` で外したもの (`.violet/` の取材ログなど) は入らない。`--cached` は
 * 作業ツリーで消したファイルも返すので、実在するものだけに絞る。
 */
export function listWorkingTree(root: string): string[] {
  const output = execFileSync(
    "git",
    ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
    { cwd: root, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  const paths = new Set(output.split("\0").filter((path) => path.length > 0));
  return [...paths]
    .filter((path) => {
      const absolute = resolve(root, path);
      return existsSync(absolute) && statSync(absolute).isFile();
    })
    .toSorted();
}

export interface ContentTreeEntry {
  readonly path: string;
  readonly hash: string;
}

export function readContentTree(root: string): ContentTreeEntry[] {
  return listWorkingTree(root).map((path) => ({
    path,
    hash: gitBlobHash(readFileSync(resolve(root, path))),
  }));
}

/**
 * 1 本のパスを読む。**列挙に出てくるパスしか読ませない。** `..` や絶対パスで作業ツリーの
 * 外を読ませないためと、`.gitignore` で外したものを名指しで引かせないため。
 */
export function readContentFile(root: string, path: string): Uint8Array | undefined {
  if (!listWorkingTree(root).includes(path)) return undefined;
  return readFileSync(resolve(root, path));
}

/**
 * 手元の機械からの要求か。dev サーバーは `--host 0.0.0.0` で LAN にも開いているので、
 * 下書きを含む作業ツリーをよその端末に読ませない。Worker の fetch は loopback から来る。
 */
export function isLoopback(address: string | undefined): boolean {
  if (address === undefined) return false;
  return address === "::1" || address.startsWith("127.") || address === "::ffff:127.0.0.1";
}

function send(res: ServerResponse, status: number, body: string | Uint8Array, type: string): void {
  res.statusCode = status;
  res.setHeader("content-type", type);
  res.setHeader("cache-control", "no-store");
  res.end(body);
}

function handle(root: string, req: IncomingMessage, res: ServerResponse): void {
  if (!isLoopback(req.socket.remoteAddress)) {
    send(res, 403, "The content bridge only answers the local machine.", "text/plain");
    return;
  }
  const url = new URL(req.url ?? "/", "http://localhost");
  try {
    if (url.pathname === "/tree") {
      send(res, 200, JSON.stringify({ entries: readContentTree(root) }), "application/json");
      return;
    }
    if (url.pathname === "/file") {
      const bytes = readContentFile(root, url.searchParams.get("path") ?? "");
      if (bytes === undefined) send(res, 404, "Not found.", "text/plain");
      else send(res, 200, bytes, "application/octet-stream");
      return;
    }
    send(res, 404, "Not found.", "text/plain");
  } catch (error) {
    // 読めないときに空のツリーを返すと、refresh が「記事が全部消えた」と受け取る (fail-loud)。
    send(res, 500, `Cannot read the content repository at ${root}: ${String(error)}`, "text/plain");
  }
}

/**
 * dev サーバーにだけ口を足す (`apply: "serve"`)。build にも preview にも入らない。
 *
 * 読む先は環境変数 `CONTENT_DIR` で、既定はこのリポジトリ直下の `content/`
 * (production のコンテンツリポジトリを clone する場所。product.md)。
 */
export function contentBridgePlugin(): Plugin {
  return {
    name: "yantene:content-bridge",
    apply: "serve",
    configureServer(server) {
      const root = resolve(server.config.root, process.env["CONTENT_DIR"] ?? "content");
      server.middlewares.use(CONTENT_BRIDGE_PATH, (req, res) => {
        handle(root, req, res);
      });
    },
  };
}
