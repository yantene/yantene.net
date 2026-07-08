import { describe, expect, it, vi } from "vitest";

// 本物の Inertia SSR は vitest では回らないため renderPage をスタブし、
// rootView 自体のロジック (jsonLd / og / HTML 組み立て) を検証する。
vi.mock("~/frontend/entry.server", () => ({
  renderPage: () =>
    Promise.resolve({
      head: ["<title>t</title>"],
      body: '<div id="app"></div>',
    }),
}));

const { rootView } = await import("./root-view");

function context(
  url = "http://localhost/notes",
): Parameters<typeof rootView>[1] {
  return { req: { url } } as unknown as Parameters<typeof rootView>[1];
}

describe("rootView", () => {
  it("renders a page WITHOUT jsonLd without throwing (500 回帰の防止)", async () => {
    const page = { props: { locale: "ja" } };
    const html = await rootView(page as never, context());
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).not.toContain("application/ld+json");
  });

  it("emits a ld+json script when a page provides jsonLd", async () => {
    const page = {
      props: { locale: "ja", jsonLd: { "@type": "BlogPosting" } },
    };
    const html = await rootView(page as never, context());
    expect(html).toContain("application/ld+json");
  });
});
