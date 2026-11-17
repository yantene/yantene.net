import type { Route } from "./+types/slides.$slug";
import type { ContentStatus } from "~/backend/domain/shared";
import type { Root } from "mdast";
import { RouterContextProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { headers, loader, meta } from "./slides.$slug";
import { SlideSlug } from "~/backend/domain/slide";
import * as currentAccountModule from "~/backend/handlers/auth/current-account";
import { seedSlide } from "~/backend/handlers/slides/test-seed";
import { createTestD1 } from "~/backend/infra/d1/test-helper";
import { R2SlideContentCache } from "~/backend/infra/r2/r2-slide-content-cache";
import { createTestR2 } from "~/backend/infra/r2/test-helper";
import { cloudflareContext } from "~/frontend/lib/route-context";

/*
 * スライドのページと status (ADR 0040)。記事のページと同じ表になること。
 *
 * 読み取り口の切り替えと欄の中身は `pages.handler.test.ts` が固定している。ここが見るのは
 * **loader がそれを応答のステータスとヘッダーに写すところ**と、`meta` が robots を立てる
 * ところ。
 */
const SLUG = "semantic-slides";

const BODY: Root = {
  type: "root",
  children: [{ type: "paragraph", children: [{ type: "text", value: "語り。" }] }],
};

type LoaderResult = Awaited<ReturnType<typeof loader>>;

async function load(status: ContentStatus): Promise<LoaderResult> {
  const d1 = createTestD1();
  const { bucket } = createTestR2();
  await seedSlide(d1, { status });
  await new R2SlideContentCache(bucket).putMdast(SlideSlug.create(SLUG), BODY);

  const context = new RouterContextProvider();
  context.set(cloudflareContext, {
    env: { D1: d1, R2: bucket, APP_ENV: "test" } as unknown as Env,
    ctx: {} as unknown as ExecutionContext,
  });
  const request = new Request(`https://example.test/slides/${SLUG}`);
  return loader({
    request,
    url: new URL(request.url),
    params: { slug: SLUG },
    pattern: "/slides/:slug",
    context,
  } satisfies Route.LoaderArgs);
}

function statusOf(result: LoaderResult): number {
  return result.init?.status ?? 200;
}

function headersOf(result: LoaderResult): Headers {
  return new Headers(result.init?.headers);
}

function robotsOf(result: LoaderResult): readonly string[] {
  const descriptors =
    meta({ loaderData: result.data, location: { pathname: `/slides/${SLUG}` } } as never) ?? [];
  return descriptors.flatMap((descriptor) =>
    "name" in descriptor && descriptor.name === "robots" ? [String(descriptor.content)] : [],
  );
}

function asAdmin(): void {
  vi.spyOn(currentAccountModule, "currentAccount").mockResolvedValue({
    email: { toString: () => "admin@example.test" } as never,
    admin: true,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("スライドのページの loader と status", () => {
  it("published は 200 で、何も足さない", async () => {
    const result = await load("published");

    expect(statusOf(result)).toBe(200);
    expect(headersOf(result).get("X-Robots-Tag")).toBeNull();
    expect(headersOf(result).get("Cache-Control")).toBeNull();
    expect(robotsOf(result)).toEqual([]);
  });

  /* ヘッダーと meta の両方で伝える。meta だけだと、ヘッダーだけを見る収集に伝わらない。 */
  it("unlisted は 200 で、ヘッダーと meta の両方に noindex を立てる", async () => {
    const result = await load("unlisted");

    expect(statusOf(result)).toBe(200);
    expect(headersOf(result).get("X-Robots-Tag")).toBe("noindex");
    expect(robotsOf(result)).toEqual(["noindex"]);
    expect(headersOf(result).get("Cache-Control")).toBeNull();
  });

  it.each(["withdrawn", "draft", "idea"] as const)("%s は読み手に 404", async (status) => {
    const result = await load(status);

    expect(statusOf(result)).toBe(404);
    expect(result.data.slide).toBeNull();
    expect(result.data.mdast).toBeNull();
  });

  it.each(["withdrawn", "draft", "idea"] as const)(
    "管理者には %s が 200 で、private, no-store が付く",
    async (status) => {
      asAdmin();

      const result = await load(status);

      expect(statusOf(result)).toBe(200);
      expect(result.data.slide?.slug).toBe(SLUG);
      expect(headersOf(result).get("Cache-Control")).toBe("private, no-store");
      expect(headersOf(result).get("Vary")).toBe("Cookie");
    },
  );

  /* 読み手も辿り着けるものは中身が同じなので、管理者が見ていても遠ざけない (記事と同じ)。 */
  it.each(["published", "unlisted"] as const)(
    "管理者が %s を開いても private, no-store は付かない",
    async (status) => {
      asAdmin();

      const result = await load(status);

      expect(statusOf(result)).toBe(200);
      expect(headersOf(result).get("Cache-Control")).toBeNull();
    },
  );
});

/*
 * loader が付けたヘッダーを文書の応答まで運ぶ関数。
 *
 * ⚠️ **この export を消すと黙って捨てられる** (articles.$slug.test.ts の同じ番人を参照)。
 * 管理者の下書きが `private, no-store` 無しで配られ、画面は何も変わらないので気づけない。
 */
describe("スライドのページの headers", () => {
  const call = (fromLoader: Headers, parent: Headers = new Headers()): Headers =>
    new Headers(
      headers({
        loaderHeaders: fromLoader,
        parentHeaders: parent,
        actionHeaders: new Headers(),
        errorHeaders: undefined,
      }),
    );

  it("管理者向けのキャッシュ指定を運ぶ", () => {
    const result = call(new Headers({ "Cache-Control": "private, no-store", Vary: "Cookie" }));

    expect(result.get("Cache-Control")).toBe("private, no-store");
    expect(result.get("Vary")).toBe("Cookie");
  });

  it("限定公開の X-Robots-Tag を運ぶ", () => {
    expect(call(new Headers({ "X-Robots-Tag": "noindex" })).get("X-Robots-Tag")).toBe("noindex");
  });

  it("親のヘッダーを消さない", () => {
    expect(call(new Headers(), new Headers({ "X-From-Parent": "kept" })).get("X-From-Parent")).toBe(
      "kept",
    );
  });

  it("loader が何も付けなければ何も足さない", () => {
    expect(call(new Headers()).get("Cache-Control")).toBeNull();
  });
});
