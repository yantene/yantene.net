import { describe, expect, it, vi } from "vitest";
import {
  ArtifactsContentStore,
  ArtifactsRequestError,
  parseTreeResponse,
} from "./artifacts-content-store";

function store(fetchFn: typeof fetch): ArtifactsContentStore {
  return new ArtifactsContentStore({
    accountId: "acct-1",
    namespace: "yantene",
    repo: "notes",
    branch: "main",
    baseUrl: "https://api.test/client/v4",
    getAuthToken: () => Promise.resolve("tok-123"),
    fetchFn,
  });
}

describe("parseTreeResponse", () => {
  it("keeps blob entries and drops directories", () => {
    const json = {
      result: {
        tree: [
          { path: "notes/a.md", type: "blob", oid: "h1" },
          { path: "notes", type: "tree", oid: "h2" },
          { path: "notes/a/cover.png", type: "blob", oid: "h3" },
        ],
      },
    };
    expect(parseTreeResponse(json)).toEqual([
      { path: "notes/a.md", hash: "h1" },
      { path: "notes/a/cover.png", hash: "h3" },
    ]);
  });

  it("accepts sha or hash as the hash field and a bare array", () => {
    expect(
      parseTreeResponse([
        { path: "x.md", sha: "s1" },
        { path: "y.md", hash: "s2" },
      ]),
    ).toEqual([
      { path: "x.md", hash: "s1" },
      { path: "y.md", hash: "s2" },
    ]);
  });

  it("ignores malformed entries within a recognized tree", () => {
    // null / 数値 / hash 欠落エントリはすべて落ちる (形自体は認識できる)。
    expect(
      parseTreeResponse({ result: { tree: [null, 1, { path: "z" }] } }),
    ).toEqual([]);
  });

  it("returns [] for a legitimately empty tree", () => {
    expect(parseTreeResponse({ result: { tree: [] } })).toEqual([]);
    expect(parseTreeResponse([])).toEqual([]);
  });

  it("throws (fail-loud) on unrecognized shapes and error envelopes", () => {
    // 認識できない形で [] にフォールバックすると全ノート削除と誤認されるため throw。
    expect(() => parseTreeResponse("nope")).toThrow(ArtifactsRequestError);
    expect(() => parseTreeResponse({ foo: 1 })).toThrow(ArtifactsRequestError);
    expect(() =>
      parseTreeResponse({ success: false, errors: [{ code: 1 }] }),
    ).toThrow(ArtifactsRequestError);
  });
});

describe("ArtifactsContentStore", () => {
  it("lists the tree with a Bearer token from getAuthToken", async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(
        Response.json({ result: { tree: [{ path: "a.md", oid: "h1" }] } }),
      ),
    ) as unknown as typeof fetch;

    const entries = await store(fetchFn).listTree();
    expect(entries).toEqual([{ path: "a.md", hash: "h1" }]);

    const [url, init] = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(url).toBe(
      "https://api.test/client/v4/accounts/acct-1/artifacts/namespaces/yantene/repos/notes/tree/main",
    );
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer tok-123",
    });
  });

  it("reads a file's bytes by path", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const fetchFn = vi.fn(() =>
      Promise.resolve(new Response(bytes)),
    ) as unknown as typeof fetch;

    const result = await store(fetchFn).readFile("notes/a.md");
    expect(result).toEqual(bytes);

    const [url] = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(url).toBe(
      "https://api.test/client/v4/accounts/acct-1/artifacts/namespaces/yantene/repos/notes/file?ref=main&path=notes%2Fa.md",
    );
  });

  it("returns undefined when a file is missing (404)", async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(new Response("not found", { status: 404 })),
    ) as unknown as typeof fetch;
    expect(await store(fetchFn).readFile("missing.md")).toBeUndefined();
  });

  it("throws ArtifactsRequestError on other non-ok responses", async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(new Response("boom", { status: 500 })),
    ) as unknown as typeof fetch;
    await expect(store(fetchFn).listTree()).rejects.toBeInstanceOf(
      ArtifactsRequestError,
    );
  });

  it("mints the auth token once and reuses it across operations", async () => {
    const getAuthToken = vi.fn(() => Promise.resolve("tok-123"));
    const fetchFn = vi.fn(() =>
      Promise.resolve(Response.json({ result: { tree: [] } })),
    ) as unknown as typeof fetch;
    const contentStore = new ArtifactsContentStore({
      accountId: "acct-1",
      namespace: "yantene",
      repo: "notes",
      branch: "main",
      baseUrl: "https://api.test/client/v4",
      getAuthToken,
      fetchFn,
    });

    await contentStore.listTree();
    await contentStore.readFile("a.md");
    await contentStore.listTree();

    expect(getAuthToken).toHaveBeenCalledTimes(1);
  });
});
