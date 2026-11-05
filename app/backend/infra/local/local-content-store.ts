import type { ContentEntry, IContentStore } from "~/backend/domain/content";

const HTTP_NOT_FOUND = 404;

/** エラーに載せる応答本文の長さの上限。 */
const MAX_ERROR_BODY = 200;

export interface LocalContentStoreConfig {
  /** dev サーバーの口 (例: `http://localhost:5173/__content`)。 */
  readonly baseUrl: string;
  /** fetch 実装 (テスト差し替え用)。 */
  readonly fetchFn?: typeof fetch;
}

export class LocalContentRequestError extends Error {
  readonly name = "LocalContentRequestError";
  constructor(
    readonly status: number,
    detail: string,
  ) {
    super(`Local content request failed (${String(status)}): ${detail}`);
  }
}

/**
 * 手元のコンテンツリポジトリの作業ツリーを読む {@link IContentStore} 実装 (ADR 0047)。
 *
 * Worker からホストのファイルは読めないので、Vite の dev サーバーが出す口
 * (`vite/content-bridge.ts`) を fetch する。`pnpm dev` の中でしか動かない。
 *
 * ハッシュは git の blob ハッシュで、Artifacts の tree と同じ値になる。
 */
export class LocalContentStore implements IContentStore {
  private readonly fetchFn: typeof fetch;
  /** 1 回の同期で記事とプロフィールが同じ姿を見るよう、ツリーはストア内で使い回す。 */
  private treePromise?: Promise<readonly ContentEntry[]>;

  constructor(private readonly config: LocalContentStoreConfig) {
    // global fetch は this を globalThis にして呼ぶ (Workers の Illegal invocation 避け)。
    this.fetchFn =
      config.fetchFn ??
      ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) =>
        fetch(input, init));
  }

  listTree(): Promise<readonly ContentEntry[]> {
    this.treePromise ??= this.fetchTree();
    return this.treePromise;
  }

  private async fetchTree(): Promise<readonly ContentEntry[]> {
    const response = await this.fetchFn(`${this.config.baseUrl}/tree`, { cache: "no-store" });
    if (!response.ok) {
      throw new LocalContentRequestError(response.status, await safeText(response));
    }
    return parseTreeResponse(await response.json());
  }

  async readFile(path: string): Promise<Uint8Array | undefined> {
    const response = await this.fetchFn(
      `${this.config.baseUrl}/file?path=${encodeURIComponent(path)}`,
      { cache: "no-store" },
    );
    if (response.status === HTTP_NOT_FOUND) return undefined;
    if (!response.ok) {
      throw new LocalContentRequestError(response.status, await safeText(response));
    }
    return new Uint8Array(await response.arrayBuffer());
  }
}

async function safeText(response: Response): Promise<string> {
  try {
    return (await response.text()).slice(0, MAX_ERROR_BODY);
  } catch {
    return "<no body>";
  }
}

/**
 * `GET /tree` の応答を読む。形が違えば空にせず throw する。空のツリーを返すと、
 * refresh が「記事が全部消えた」と受け取る (fail-loud)。
 */
export function parseTreeResponse(json: unknown): ContentEntry[] {
  const entries = (json as { entries?: unknown } | null)?.entries;
  if (!Array.isArray(entries)) {
    throw new LocalContentRequestError(200, "tree response has no entry array");
  }
  return entries.map((raw: unknown) => {
    const record = (typeof raw === "object" && raw !== null ? raw : {}) as {
      path?: unknown;
      hash?: unknown;
    };
    if (typeof record.path !== "string" || typeof record.hash !== "string") {
      throw new LocalContentRequestError(200, "tree response has a malformed entry");
    }
    return { path: record.path, hash: record.hash };
  });
}
