import type { ContentEntry, IContentStore } from "~/backend/domain/content";

const DEFAULT_BASE_URL = "https://api.cloudflare.com/client/v4";
const HTTP_OK = 200;
const HTTP_NOT_FOUND = 404;

export interface ArtifactsContentStoreConfig {
  /** Cloudflare アカウント ID。REST のパスに入る。 */
  readonly accountId: string;
  /** Artifacts の namespace。 */
  readonly namespace: string;
  /** リポジトリ名。 */
  readonly repo: string;
  /** 読み取り対象のブランチ (既定 "main")。 */
  readonly branch?: string;
  /** REST API のベース URL (テスト差し替え用)。 */
  readonly baseUrl?: string;
  /**
   * Bearer に載せる Cloudflare API トークンを取得する。権限は Artifacts > Read だけで足りる
   * (ADR 0034)。
   */
  readonly getAuthToken: () => Promise<string>;
  /** fetch 実装 (テスト差し替え用)。 */
  readonly fetchFn?: typeof fetch;
}

export class ArtifactsRequestError extends Error {
  readonly name = "ArtifactsRequestError";
  constructor(
    readonly status: number,
    detail: string,
  ) {
    super(`Artifacts request failed (${String(status)}): ${detail}`);
  }
}

/** `GET /tree/:hash` が返す 1 エントリ。 */
export interface ArtifactsTreeEntry {
  readonly name: string;
  readonly hash: string;
  readonly type: "tree" | "blob" | "exec" | "symlink" | "gitlink";
}

/**
 * Cloudflare Artifacts のリポジトリをコンテンツ正本として使う {@link IContentStore} 実装。
 *
 * 読むのは REST API だけ (ADR 0034)。Workers binding にはファイルの中身を読む口が無く、
 * ツリーを読む口も wrangler の型に無いため、経路を 1 つに揃えてある。
 *
 * - listTree: `log?ref=<branch>&limit=1` で先頭コミットの tree ハッシュを取り、
 *   `tree/:hash` をディレクトリごとに辿って全ファイルを集める。ハッシュは git の
 *   blob ハッシュ (SHA-1) で、GitHub の tree API が返す `sha` と同じ値になる。
 *   変更検出 (D1 の contentHash) はそのまま引き継げる。
 * - readFile: `file?ref=<branch>&path=<path>` で生バイト列を受ける。
 *
 * ドメイン・refresh・D1 / R2 は正本の種類を知らないので、GitHub 実装との差し替えは
 * Composition Root (`resolveContentStore`) だけで済む。
 */
export class ArtifactsContentStore implements IContentStore {
  private readonly branch: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  /** トークンはストア (= 1 回の refresh) 内で使い回す。 */
  private tokenPromise?: Promise<string>;

  constructor(private readonly config: ArtifactsContentStoreConfig) {
    this.branch = config.branch ?? "main";
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    // global fetch は正しい this (globalThis) で呼ぶ必要がある。プロパティ経由の
    // メソッド呼び出しだと this が instance になり Workers が Illegal invocation を投げる。
    this.fetchFn =
      config.fetchFn ??
      ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
        fetch(input, init));
  }

  private repoPath(): string {
    const { accountId, namespace, repo } = this.config;
    return `${this.baseUrl}/accounts/${accountId}/artifacts/namespaces/${namespace}/repos/${repo}`;
  }

  private async headers(): Promise<Record<string, string>> {
    this.tokenPromise ??= this.config.getAuthToken();
    const token = await this.tokenPromise;
    return {
      Authorization: `Bearer ${token}`,
      "User-Agent": "yantene.net-content-store",
    };
  }

  private async getJson(url: string, init: RequestInit): Promise<unknown> {
    const response = await this.fetchFn(url, { ...init, headers: await this.headers() });
    if (!response.ok) {
      throw new ArtifactsRequestError(response.status, await safeText(response));
    }
    return response.json();
  }

  async listTree(): Promise<readonly ContentEntry[]> {
    // ブランチの先端は動くので、Workers の fetch キャッシュを回避する。これが無いと
    // push 後も古いコミットが返り、refresh の変更検出が取りこぼす。
    const log = await this.getJson(
      `${this.repoPath()}/log?ref=${encodeURIComponent(this.branch)}&limit=1`,
      { cache: "no-store" },
    );
    const rootTreeHash = parseLogResponse(log);
    return this.walkTree(rootTreeHash, "");
  }

  /**
   * ツリーをハッシュで辿る。`tree/:hash` は 1 階層しか返さないので、ディレクトリごとに
   * 呼ぶ。ハッシュで引くツリーは不変なので、こちらはキャッシュを避けなくてよい。
   */
  private async walkTree(hash: string, prefix: string): Promise<ContentEntry[]> {
    const entries = parseTreeResponse(await this.getJson(`${this.repoPath()}/tree/${hash}`, {}));
    const files = entries
      .filter((entry) => entry.type === "blob" || entry.type === "exec")
      .map((entry) => ({ path: `${prefix}${entry.name}`, hash: entry.hash }));
    const subtrees = await Promise.all(
      entries
        .filter((entry) => entry.type === "tree")
        .map((entry) => this.walkTree(entry.hash, `${prefix}${entry.name}/`)),
    );
    return [...files, ...subtrees.flat()];
  }

  async readFile(path: string): Promise<Uint8Array | undefined> {
    const url =
      `${this.repoPath()}/file` +
      `?ref=${encodeURIComponent(this.branch)}&path=${encodeURIComponent(path)}`;
    const response = await this.fetchFn(url, {
      headers: await this.headers(),
      cache: "no-store",
    });
    if (response.status === HTTP_NOT_FOUND) return undefined;
    if (!response.ok) {
      throw new ArtifactsRequestError(response.status, await safeText(response));
    }
    // 中身は octet-stream で返る。エラーの封筒 (JSON) が 200 で返ってきたときに、
    // その JSON を記事の本文として R2 に書き込まないようにする (fail-loud)。
    if ((response.headers.get("content-type") ?? "").includes("json")) {
      throw new ArtifactsRequestError(response.status, await safeText(response));
    }
    return new Uint8Array(await response.arrayBuffer());
  }
}

async function safeText(response: Response): Promise<string> {
  try {
    const text = await response.text();
    return text.slice(0, 200);
  } catch {
    return "<no body>";
  }
}

/**
 * Cloudflare API v4 の封筒 (`{ result, success, errors, messages }`) から result を取り出す。
 *
 * HTTP 200 でも `success: false` は失敗として扱う。認識できない形は空にフォールバックせず
 * throw する。黙って [] を返すと refresh が「全ノート削除」と誤認しかねない (fail-loud)。
 */
function unwrapEnvelope(json: unknown, what: string): { result: unknown; resultInfo: unknown } {
  if (typeof json !== "object" || json === null) {
    throw new ArtifactsRequestError(HTTP_OK, `unrecognized ${what} response`);
  }
  const envelope = json as {
    result?: unknown;
    success?: unknown;
    errors?: unknown;
    result_info?: unknown;
  };
  if (envelope.success !== true) {
    throw new ArtifactsRequestError(
      HTTP_OK,
      `${what} response reported failure: ${describeErrors(envelope.errors)}`,
    );
  }
  return { result: envelope.result, resultInfo: envelope.result_info };
}

function describeErrors(errors: unknown): string {
  if (!Array.isArray(errors) || errors.length === 0) return "<no errors>";
  return errors
    .map((error) => {
      const record = (typeof error === "object" && error !== null ? error : {}) as {
        code?: unknown;
        message?: unknown;
      };
      const code = typeof record.code === "number" ? String(record.code) : "?";
      const message = typeof record.message === "string" ? record.message : "";
      return `${code} ${message}`.trim();
    })
    .join("; ");
}

/**
 * `GET /log?ref=&limit=1` の応答から、先頭コミットの tree ハッシュを取り出す。
 *
 * コミットが 1 つも無い (空のブランチ) は throw する。空のツリーを返すと、その先の
 * refresh が「正本が空になった」と受け取って掃除に進む。
 */
export function parseLogResponse(json: unknown): string {
  const { result } = unwrapEnvelope(json, "log");
  if (!Array.isArray(result)) {
    throw new ArtifactsRequestError(HTTP_OK, "log response has no commit array");
  }
  const [head] = result;
  if (typeof head !== "object" || head === null) {
    throw new ArtifactsRequestError(HTTP_OK, "log response has no commits on the ref");
  }
  const treeHash = (head as { treeHash?: unknown }).treeHash;
  if (typeof treeHash !== "string" || treeHash.length === 0) {
    throw new ArtifactsRequestError(HTTP_OK, "log response has a commit without treeHash");
  }
  return treeHash;
}

const TREE_ENTRY_TYPES: ReadonlySet<string> = new Set([
  "tree",
  "blob",
  "exec",
  "symlink",
  "gitlink",
]);

/**
 * `GET /tree/:hash` の応答を {@link ArtifactsTreeEntry}[] に変換する。
 *
 * 形状は `{ result: [{ name, mode, hash, type }], result_info? }` (OpenAPI で確定)。
 * 分割された応答 (次のページがある) は、ツリーの一部しか見ていないので throw する。
 * GitHub の `truncated` と同じ扱いで、欠けた分を「消えたノート」と読ませない。
 *
 * `type` が知らない値のエントリは、名前とハッシュが揃っていれば**ファイルでない物**として
 * 落とす。API に型が 1 つ増えただけで全ノートの同期が止まるのは、fail-loud の守る範囲
 * (欠けを消えたと読まない) から外れている。
 */
export function parseTreeResponse(json: unknown): ArtifactsTreeEntry[] {
  const { result, resultInfo } = unwrapEnvelope(json, "tree");
  if (!Array.isArray(result)) {
    throw new ArtifactsRequestError(HTTP_OK, "tree response has no entry array");
  }
  if (hasMorePages(resultInfo)) {
    throw new ArtifactsRequestError(
      HTTP_OK,
      "tree response is paginated; a directory too large to read in one request",
    );
  }

  const entries: ArtifactsTreeEntry[] = [];
  for (const raw of result) {
    if (typeof raw !== "object" || raw === null) {
      throw new ArtifactsRequestError(HTTP_OK, "tree response has a malformed entry");
    }
    const record = raw as { name?: unknown; hash?: unknown; type?: unknown };
    if (
      typeof record.name !== "string" ||
      typeof record.hash !== "string" ||
      typeof record.type !== "string"
    ) {
      throw new ArtifactsRequestError(HTTP_OK, "tree response has a malformed entry");
    }
    if (!TREE_ENTRY_TYPES.has(record.type)) continue;
    entries.push({
      name: record.name,
      hash: record.hash,
      type: record.type as ArtifactsTreeEntry["type"],
    });
  }
  return entries;
}

/** `result_info` がカーソル形式でもページ形式でも、続きがあるかを見る。 */
function hasMorePages(resultInfo: unknown): boolean {
  if (typeof resultInfo !== "object" || resultInfo === null) return false;
  const info = resultInfo as {
    cursor?: unknown;
    cursors?: { after?: unknown };
    page?: unknown;
    total_pages?: unknown;
  };
  if (typeof info.cursor === "string" && info.cursor.length > 0) return true;
  // Cloudflare の一覧は `cursors.after` を使う経路もある。見落とすと、欠けたツリーを
  // 完全なものとして返してしまう (欠けた分が「消えた記事」になる)。
  if (typeof info.cursors?.after === "string" && info.cursors.after.length > 0) return true;
  return (
    typeof info.page === "number" &&
    typeof info.total_pages === "number" &&
    info.total_pages > info.page
  );
}
