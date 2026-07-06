import type { ContentEntry, IContentStore } from "~/backend/domain/content";

const DEFAULT_BASE_URL = "https://api.github.com";
const HTTP_NOT_FOUND = 404;

export interface GitHubContentStoreConfig {
  /** リポジトリオーナー (user / org)。 */
  readonly owner: string;
  /** リポジトリ名。 */
  readonly repo: string;
  /** 対象ブランチ (既定 "main")。 */
  readonly branch?: string;
  /** GitHub API のベース URL (GHE 等の差し替え用)。 */
  readonly baseUrl?: string;
  /** Bearer 認証トークンを取得する (PAT / fine-grained / GitHub App の installation token)。 */
  readonly getAuthToken: () => Promise<string>;
  /** fetch 実装 (テスト差し替え用)。 */
  readonly fetchFn?: typeof fetch;
}

export class GitHubRequestError extends Error {
  readonly name = "GitHubRequestError";
  constructor(
    readonly status: number,
    detail: string,
  ) {
    super(`GitHub request failed (${String(status)}): ${detail}`);
  }
}

/**
 * GitHub リポジトリをコンテンツ正本として使う {@link IContentStore} 実装。
 *
 * - listTree: git tree API (`?recursive=1`) で全 blob を取得し、`sha` (git blob ハッシュ)
 *   を {@link ContentEntry.hash} にする。変更検出はこのハッシュで行う (Artifacts と同じ)。
 * - readFile: contents API でパス指定取得し、base64 を復号して生バイト列を返す。
 *
 * Artifacts binding が使えない (beta 未有効) 場合の代替。ドメイン・refresh・D1/R2 は
 * 一切変えずに差し替えられる (IContentStore の抽象の利点)。
 */
export class GitHubContentStore implements IContentStore {
  private readonly branch: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private tokenPromise?: Promise<string>;

  constructor(private readonly config: GitHubContentStoreConfig) {
    this.branch = config.branch ?? "main";
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    // global fetch は正しい this (globalThis) で呼ぶ必要がある。プロパティ経由の
    // メソッド呼び出しだと this が instance になり Workers が Illegal invocation を投げる。
    this.fetchFn =
      config.fetchFn ??
      ((
        input: Parameters<typeof fetch>[0],
        init?: Parameters<typeof fetch>[1],
      ) => fetch(input, init));
  }

  private repoPath(): string {
    return `${this.baseUrl}/repos/${this.config.owner}/${this.config.repo}`;
  }

  private async headers(): Promise<Record<string, string>> {
    this.tokenPromise ??= this.config.getAuthToken();
    const token = await this.tokenPromise;
    return {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "yantene.net-content-store",
      "X-GitHub-Api-Version": "2022-11-28",
    };
  }

  async listTree(): Promise<readonly ContentEntry[]> {
    const url = `${this.repoPath()}/git/trees/${encodeURIComponent(this.branch)}?recursive=1`;
    // cache: "no-store" で Workers の fetch キャッシュを回避する。これが無いと
    // push 後も古いツリー/内容が返り、refresh の変更検出が取りこぼす。
    const response = await this.fetchFn(url, {
      headers: await this.headers(),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new GitHubRequestError(response.status, await safeText(response));
    }
    return parseTreeResponse(await response.json());
  }

  async readFile(path: string): Promise<Uint8Array | undefined> {
    const encodedPath = path
      .split("/")
      .map((segment) => encodeURIComponent(segment))
      .join("/");
    const url =
      `${this.repoPath()}/contents/${encodedPath}` +
      `?ref=${encodeURIComponent(this.branch)}`;
    const response = await this.fetchFn(url, {
      headers: {
        ...(await this.headers()),
        // raw メディアタイプで生バイトを直接受け取る (base64 復号不要)。
        Accept: "application/vnd.github.raw+json",
      },
      cache: "no-store",
    });
    if (response.status === HTTP_NOT_FOUND) return undefined;
    if (!response.ok) {
      throw new GitHubRequestError(response.status, await safeText(response));
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

interface GitTreeEntry {
  path?: unknown;
  type?: unknown;
  sha?: unknown;
}

/**
 * git tree API のレスポンスを {@link ContentEntry}[] に変換する。
 * 形状: `{ tree: [{ path, type: "blob"|"tree", sha }], truncated }`。
 * blob (ファイル) のみ返す。`truncated` が true のときは snapshot が不完全で、
 * 全ノート削除と誤認しかねないため fail-loud で throw する。
 */
export function parseTreeResponse(json: unknown): ContentEntry[] {
  if (typeof json !== "object" || json === null) {
    throw new GitHubRequestError(200, "unrecognized tree response");
  }
  const record = json as { tree?: unknown; truncated?: unknown };
  if (record.truncated === true) {
    throw new GitHubRequestError(
      200,
      "tree response is truncated; repository too large for a single tree request",
    );
  }
  if (!Array.isArray(record.tree)) {
    throw new GitHubRequestError(200, "tree response has no tree array");
  }

  const entries: ContentEntry[] = [];
  for (const raw of record.tree) {
    if (typeof raw !== "object" || raw === null) continue;
    const entry = raw as GitTreeEntry;
    if (entry.type !== "blob") continue; // ディレクトリ (tree) は除外
    if (typeof entry.path === "string" && typeof entry.sha === "string") {
      entries.push({ path: entry.path, hash: entry.sha });
    }
  }
  return entries;
}
