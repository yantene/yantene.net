import { describe, expect, it, vi } from "vitest";
import {
  ArtifactsContentStore,
  ArtifactsRequestError,
  parseLogResponse,
  parseTreeResponse,
} from "./artifacts-content-store";

const BASE =
  "https://api.test/client/v4/accounts/acct-1/artifacts/namespaces/yantene/repos/yantene-staging";

function envelope(result: unknown, resultInfo?: unknown): Response {
  return Response.json({
    result,
    success: true,
    errors: [],
    messages: [],
    ...(resultInfo === undefined ? {} : { result_info: resultInfo }),
  });
}

function store(
  fetchFn: typeof fetch,
  getAuthToken = (): Promise<string> => Promise.resolve("cf-token"),
): ArtifactsContentStore {
  return new ArtifactsContentStore({
    accountId: "acct-1",
    namespace: "yantene",
    repo: "yantene-staging",
    branch: "main",
    baseUrl: "https://api.test/client/v4",
    getAuthToken,
    fetchFn,
  });
}

/** URL ごとに応答を返す fetch。呼ばれた URL と init を記録する。 */
function routes(table: Record<string, () => Response>): {
  fetchFn: typeof fetch;
  calls: { url: string; init: RequestInit | undefined }[];
} {
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const fetchFn = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    calls.push({ url, init });
    const respond = table[url];
    if (respond === undefined) {
      return Promise.resolve(new Response(`unexpected ${url}`, { status: 599 }));
    }
    return Promise.resolve(respond());
  }) as unknown as typeof fetch;
  return { fetchFn, calls };
}

describe("parseLogResponse", () => {
  it("returns the tree hash of the first commit", () => {
    const json = {
      result: [
        { hash: "c1", treeHash: "t1", message: "x" },
        { hash: "c0", treeHash: "t0" },
      ],
      success: true,
      errors: [],
      messages: [],
    };
    expect(parseLogResponse(json)).toBe("t1");
  });

  it("throws (fail-loud) when the ref has no commits", () => {
    // 空のツリーを返すと、refresh が「コンテンツリポジトリが空になった」と受け取って掃除に進む。
    expect(() => parseLogResponse({ result: [], success: true, errors: [], messages: [] })).toThrow(
      ArtifactsRequestError,
    );
  });

  it("throws on error envelopes and unrecognized shapes", () => {
    expect(() =>
      parseLogResponse({
        result: null,
        success: false,
        errors: [{ code: 10200, message: "Ref not found" }],
        messages: [],
      }),
    ).toThrow(/10200 Ref not found/);
    expect(() => parseLogResponse("nope")).toThrow(ArtifactsRequestError);
    expect(() => parseLogResponse({ result: [{ hash: "c1" }], success: true })).toThrow(
      /without treeHash/,
    );
  });
});

describe("parseTreeResponse", () => {
  it("keeps every entry with its name, hash and type", () => {
    const json = {
      result: [
        { name: "notes", mode: "40000", hash: "t2", type: "tree" },
        { name: "README.md", mode: "100644", hash: "b1", type: "blob" },
        { name: "run.sh", mode: "100755", hash: "b2", type: "exec" },
      ],
      success: true,
      errors: [],
      messages: [],
    };
    expect(parseTreeResponse(json)).toEqual([
      { name: "notes", hash: "t2", type: "tree" },
      { name: "README.md", hash: "b1", type: "blob" },
      { name: "run.sh", hash: "b2", type: "exec" },
    ]);
  });

  it("returns [] for a legitimately empty tree", () => {
    expect(parseTreeResponse({ result: [], success: true, errors: [], messages: [] })).toEqual([]);
  });

  it("accepts a result_info that says there is no next page", () => {
    const info = { cursor: "", per_page: 50, count: 1 };
    const json = {
      result: [{ name: "a.md", mode: "100644", hash: "b1", type: "blob" }],
      success: true,
      errors: [],
      messages: [],
      result_info: info,
    };
    expect(parseTreeResponse(json)).toHaveLength(1);
    expect(
      parseTreeResponse({
        ...json,
        result_info: { page: 1, per_page: 50, total_pages: 1, count: 1, total_count: 1 },
      }),
    ).toHaveLength(1);
  });

  it("throws (fail-loud) when the tree is paginated", () => {
    // 一部しか見ていないツリーを完全なものとして返すと、欠けた分が「消えたノート」になる。
    const json = {
      result: [{ name: "a.md", mode: "100644", hash: "b1", type: "blob" }],
      success: true,
      errors: [],
      messages: [],
    };
    expect(() =>
      parseTreeResponse({ ...json, result_info: { cursor: "next", per_page: 1, count: 1 } }),
    ).toThrow(/paginated/);
    expect(() =>
      parseTreeResponse({
        ...json,
        result_info: { page: 1, per_page: 1, total_pages: 2, count: 1, total_count: 2 },
      }),
    ).toThrow(/paginated/);
    // Cloudflare の一覧はこの形でも次のページを示す。
    expect(() =>
      parseTreeResponse({ ...json, result_info: { cursors: { after: "next" }, count: 1 } }),
    ).toThrow(/paginated/);
  });

  it("drops entries of an unknown type instead of aborting the sync", () => {
    // 型が 1 つ増えただけで全ノートの同期が止まらないように。名前とハッシュは要る。
    const ok = { success: true, errors: [], messages: [] };
    expect(
      parseTreeResponse({
        ...ok,
        result: [
          { name: "a.md", mode: "100644", hash: "h1", type: "blob" },
          { name: "odd", mode: "160000", hash: "h2", type: "weird" },
        ],
      }),
    ).toEqual([{ name: "a.md", hash: "h1", type: "blob" }]);
  });

  it("throws on malformed entries, error envelopes and unrecognized shapes", () => {
    const ok = { success: true, errors: [], messages: [] };
    expect(() => parseTreeResponse({ ...ok, result: [null] })).toThrow(ArtifactsRequestError);
    expect(() => parseTreeResponse({ ...ok, result: [{ name: "a", hash: "h" }] })).toThrow(
      ArtifactsRequestError,
    );
    expect(() => parseTreeResponse({ ...ok, result: { tree: [] } })).toThrow(ArtifactsRequestError);
    expect(() => parseTreeResponse({ success: false, errors: [], result: null })).toThrow(
      ArtifactsRequestError,
    );
    expect(() => parseTreeResponse("nope")).toThrow(ArtifactsRequestError);
  });
});

describe("ArtifactsContentStore", () => {
  it("lists every file by walking the tree of the branch head", async () => {
    const { fetchFn, calls } = routes({
      [`${BASE}/log?ref=main&limit=1`]: () => envelope([{ hash: "c1", treeHash: "root" }]),
      [`${BASE}/tree/root`]: () =>
        envelope([
          { name: "README.md", mode: "100644", hash: "b0", type: "blob" },
          { name: "notes", mode: "40000", hash: "t-notes", type: "tree" },
        ]),
      [`${BASE}/tree/t-notes`]: () =>
        envelope([
          { name: "a.md", mode: "100644", hash: "b1", type: "blob" },
          { name: "a", mode: "40000", hash: "t-a", type: "tree" },
          { name: "link", mode: "120000", hash: "s1", type: "symlink" },
        ]),
      [`${BASE}/tree/t-a`]: () =>
        envelope([{ name: "cover.png", mode: "100644", hash: "b2", type: "blob" }]),
    });

    const entries = await store(fetchFn).listTree();

    expect(entries).toEqual([
      { path: "README.md", hash: "b0" },
      { path: "notes/a.md", hash: "b1" },
      { path: "notes/a/cover.png", hash: "b2" },
    ]);
    // ブランチの先端は動くので、log はキャッシュを避けて読む。
    const log = calls.find((call) => call.url.includes("/log?"));
    expect(log?.init).toMatchObject({ cache: "no-store" });
    expect(log?.init?.headers).toMatchObject({ Authorization: "Bearer cf-token" });
  });

  it("reads a file's raw bytes by path at the branch", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const { fetchFn, calls } = routes({
      [`${BASE}/file?ref=main&path=notes%2Fa.md`]: () => new Response(bytes),
    });

    const result = await store(fetchFn).readFile("notes/a.md");

    expect(result).toEqual(bytes);
    expect(calls[0]?.init).toMatchObject({ cache: "no-store" });
    expect(calls[0]?.init?.headers).toMatchObject({ Authorization: "Bearer cf-token" });
  });

  it("returns undefined when a file is missing (404)", async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(new Response("not found", { status: 404 })),
    ) as unknown as typeof fetch;
    expect(await store(fetchFn).readFile("missing.md")).toBeUndefined();
  });

  it("throws when a JSON envelope comes back with 200 instead of the file bytes", async () => {
    // 中身は octet-stream で返る。封筒をそのまま渡すと、その JSON が記事の本文として
    // R2 に書き込まれる。
    const fetchFn = vi.fn(() =>
      Promise.resolve(
        new Response('{"success":false,"errors":[{"code":10400}]}', {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    ) as unknown as typeof fetch;
    await expect(store(fetchFn).readFile("a.md")).rejects.toBeInstanceOf(ArtifactsRequestError);
  });

  it("throws ArtifactsRequestError on other non-ok responses", async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(new Response("boom", { status: 500 })),
    ) as unknown as typeof fetch;
    await expect(store(fetchFn).listTree()).rejects.toBeInstanceOf(ArtifactsRequestError);
    await expect(store(fetchFn).readFile("a.md")).rejects.toBeInstanceOf(ArtifactsRequestError);
  });

  it("resolves the token once and reuses it across requests", async () => {
    const getAuthToken = vi.fn(() => Promise.resolve("cf-token"));
    const { fetchFn } = routes({
      [`${BASE}/log?ref=main&limit=1`]: () => envelope([{ hash: "c1", treeHash: "root" }]),
      [`${BASE}/tree/root`]: () => envelope([]),
      [`${BASE}/file?ref=main&path=a.md`]: () => new Response(new Uint8Array([1])),
    });
    const contentStore = store(fetchFn, getAuthToken);

    await contentStore.listTree();
    await contentStore.readFile("a.md");
    await contentStore.listTree();

    expect(getAuthToken).toHaveBeenCalledTimes(1);
  });
});
