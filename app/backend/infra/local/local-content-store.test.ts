import { describe, expect, it, vi } from "vitest";
import { LocalContentRequestError, LocalContentStore } from "./local-content-store";

const BASE = "http://localhost:5173/__content";

function storeWith(handler: (url: string) => Response): {
  store: LocalContentStore;
  fetchFn: ReturnType<typeof vi.fn<typeof fetch>>;
} {
  const fetchFn = vi.fn<typeof fetch>((input) =>
    Promise.resolve(handler(input instanceof Request ? input.url : input.toString())),
  );
  return { store: new LocalContentStore({ baseUrl: BASE, fetchFn }), fetchFn };
}

describe("LocalContentStore", () => {
  it("lists the tree once per store", async () => {
    const { store, fetchFn } = storeWith(() =>
      Response.json({ entries: [{ path: "articles/a.md", hash: "abc" }] }),
    );
    expect(await store.listTree()).toStrictEqual([{ path: "articles/a.md", hash: "abc" }]);
    await store.listTree();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0]?.[0]).toBe(`${BASE}/tree`);
  });

  it("throws instead of returning an empty tree when the bridge fails", async () => {
    const { store } = storeWith(() => new Response("no content dir", { status: 500 }));
    await expect(store.listTree()).rejects.toBeInstanceOf(LocalContentRequestError);
  });

  it("throws on a malformed tree", async () => {
    const { store } = storeWith(() => Response.json({ entries: [{ path: 1 }] }));
    await expect(store.listTree()).rejects.toThrow(/malformed/);
  });

  it("reads a file by encoded path", async () => {
    const { store, fetchFn } = storeWith(() => new Response(new Uint8Array([1, 2, 3])));
    expect(await store.readFile("articles/a b.md")).toStrictEqual(new Uint8Array([1, 2, 3]));
    expect(fetchFn.mock.calls[0]?.[0]).toBe(`${BASE}/file?path=articles%2Fa%20b.md`);
  });

  it("returns undefined for a missing file", async () => {
    const { store } = storeWith(() => new Response("Not found.", { status: 404 }));
    expect(await store.readFile("articles/none.md")).toBeUndefined();
  });
});
