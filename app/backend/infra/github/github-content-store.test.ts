import { describe, expect, it, vi } from "vitest";
import {
  GitHubContentStore,
  GitHubRequestError,
  parseTreeResponse,
} from "./github-content-store";

function store(fetchFn: typeof fetch): GitHubContentStore {
  return new GitHubContentStore({
    owner: "yantene",
    repo: "notes",
    branch: "main",
    baseUrl: "https://api.test",
    getAuthToken: () => Promise.resolve("ghp_test"),
    fetchFn,
  });
}

describe("parseTreeResponse", () => {
  it("keeps blob entries (path + sha) and drops trees", () => {
    const json = {
      tree: [
        { path: "notes/a.md", type: "blob", sha: "s1" },
        { path: "notes", type: "tree", sha: "s2" },
        { path: "notes/a/cover.png", type: "blob", sha: "s3" },
      ],
      truncated: false,
    };
    expect(parseTreeResponse(json)).toEqual([
      { path: "notes/a.md", hash: "s1" },
      { path: "notes/a/cover.png", hash: "s3" },
    ]);
  });

  it("throws (fail-loud) when the tree is truncated", () => {
    expect(() => parseTreeResponse({ tree: [], truncated: true })).toThrow(
      GitHubRequestError,
    );
  });

  it("throws on unrecognized shapes", () => {
    expect(() => parseTreeResponse("nope")).toThrow(GitHubRequestError);
    expect(() => parseTreeResponse({ foo: 1 })).toThrow(GitHubRequestError);
  });
});

describe("GitHubContentStore", () => {
  it("lists the tree recursively with a Bearer token", async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(
        Response.json({
          tree: [{ path: "notes/a.md", type: "blob", sha: "s1" }],
          truncated: false,
        }),
      ),
    ) as unknown as typeof fetch;

    const entries = await store(fetchFn).listTree();
    expect(entries).toEqual([{ path: "notes/a.md", hash: "s1" }]);

    const [url, init] = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(url).toBe(
      "https://api.test/repos/yantene/notes/git/trees/main?recursive=1",
    );
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer ghp_test",
    });
  });

  it("reads a file's raw bytes by path", async () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const fetchFn = vi.fn(() =>
      Promise.resolve(new Response(bytes)),
    ) as unknown as typeof fetch;

    const result = await store(fetchFn).readFile("notes/a.md");
    expect(result).toEqual(bytes);

    const [url] = (fetchFn as unknown as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(url).toBe(
      "https://api.test/repos/yantene/notes/contents/notes/a.md?ref=main",
    );
  });

  it("returns undefined for a missing file (404)", async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(new Response("not found", { status: 404 })),
    ) as unknown as typeof fetch;
    expect(await store(fetchFn).readFile("missing.md")).toBeUndefined();
  });

  it("throws GitHubRequestError on other non-ok responses", async () => {
    const fetchFn = vi.fn(() =>
      Promise.resolve(new Response("boom", { status: 500 })),
    ) as unknown as typeof fetch;
    await expect(store(fetchFn).listTree()).rejects.toBeInstanceOf(
      GitHubRequestError,
    );
  });

  it("mints the auth token once across operations", async () => {
    const getAuthToken = vi.fn(() => Promise.resolve("ghp_test"));
    const fetchFn = vi.fn(() =>
      Promise.resolve(Response.json({ tree: [], truncated: false })),
    ) as unknown as typeof fetch;
    const contentStore = new GitHubContentStore({
      owner: "yantene",
      repo: "notes",
      baseUrl: "https://api.test",
      getAuthToken,
      fetchFn,
    });

    await contentStore.listTree();
    await contentStore.readFile("a.md");
    expect(getAuthToken).toHaveBeenCalledTimes(1);
  });
});
