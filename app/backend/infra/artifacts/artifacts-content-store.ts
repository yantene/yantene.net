import type { ContentEntry, IContentStore } from "~/backend/domain/content";

const DEFAULT_BASE_URL = "https://api.cloudflare.com/client/v4";
const HTTP_NOT_FOUND = 404;

export interface ArtifactsContentStoreConfig {
  /** Cloudflare アカウント ID。 */
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
   * Bearer 認証トークンを取得する。Composition Root では Artifacts binding で
   * リポジトリスコープの read トークンを発行して渡す想定。
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

/**
 * Cloudflare Artifacts の REST API を用いた {@link IContentStore} 実装。
 *
 * Artifacts の Workers binding はファイル読み取りを提供しない (repo 管理 + トークン
 * 発行のみ) ため、binding で発行した read トークンを Bearer に載せて REST API を叩く
 * (ADR 0005 / 0007)。
 *
 * ⚠️ tree エンドポイントのレスポンス JSON 形状は beta のため実 API で要確認。
 * 解析は {@link parseTreeResponse} に隔離してあり、形状が違えばそこだけ直せばよい。
 */
export class ArtifactsContentStore implements IContentStore {
  private readonly branch: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly config: ArtifactsContentStoreConfig) {
    this.branch = config.branch ?? "main";
    this.baseUrl = config.baseUrl ?? DEFAULT_BASE_URL;
    this.fetchFn = config.fetchFn ?? fetch;
  }

  private repoPath(): string {
    const { accountId, namespace, repo } = this.config;
    return `${this.baseUrl}/accounts/${accountId}/artifacts/namespaces/${namespace}/repos/${repo}`;
  }

  private async authHeaders(): Promise<HeadersInit> {
    const token = await this.config.getAuthToken();
    return { Authorization: `Bearer ${token}` };
  }

  async listTree(): Promise<readonly ContentEntry[]> {
    // /tree/:hash は :hash にブランチ名も受ける前提でブランチを渡す (beta・要確認)。
    const url = `${this.repoPath()}/tree/${encodeURIComponent(this.branch)}`;
    const response = await this.fetchFn(url, {
      headers: await this.authHeaders(),
    });
    if (!response.ok) {
      throw new ArtifactsRequestError(
        response.status,
        await safeText(response),
      );
    }
    return parseTreeResponse(await response.json());
  }

  async readFile(path: string): Promise<Uint8Array | undefined> {
    const url =
      `${this.repoPath()}/file` +
      `?ref=${encodeURIComponent(this.branch)}&path=${encodeURIComponent(path)}`;
    const response = await this.fetchFn(url, {
      headers: await this.authHeaders(),
    });
    if (response.status === HTTP_NOT_FOUND) return undefined;
    if (!response.ok) {
      throw new ArtifactsRequestError(
        response.status,
        await safeText(response),
      );
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
 * tree エンドポイントのレスポンスを {@link ContentEntry}[] に変換する。
 *
 * 想定形状 (Cloudflare API の標準ラッパ + git tree 慣習):
 *   { result: { tree: [ { path, type, oid|sha|hash }, ... ] }, success, ... }
 * - type が "tree" (ディレクトリ) のエントリは除外し、blob (ファイル) のみ返す
 * - ハッシュは oid / sha / hash のいずれかのフィールドから拾う
 *
 * ⚠️ 実際の beta レスポンス形状は要検証。差異があればこの関数だけを直す。
 */
export function parseTreeResponse(json: unknown): ContentEntry[] {
  const tree = extractTreeArray(json);
  const entries: ContentEntry[] = [];
  for (const raw of tree) {
    if (typeof raw !== "object" || raw === null) continue;
    const record = raw as Record<string, unknown>;
    if (record.type === "tree") continue; // ディレクトリは除外
    const path = record.path;
    const hash = record.oid ?? record.sha ?? record.hash;
    if (typeof path === "string" && typeof hash === "string") {
      entries.push({ path, hash });
    }
  }
  return entries;
}

function extractTreeArray(json: unknown): unknown[] {
  if (typeof json !== "object" || json === null) return [];
  const result = (json as { result?: unknown }).result;
  const container = result ?? json;
  if (Array.isArray(container)) return container;
  if (typeof container === "object") {
    const tree = (container as { tree?: unknown }).tree;
    if (Array.isArray(tree)) return tree;
  }
  return [];
}
