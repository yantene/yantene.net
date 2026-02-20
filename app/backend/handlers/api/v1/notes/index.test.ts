import { Temporal } from "@js-temporal/polyfill";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import {
  InvalidNoteSlugError,
  MarkdownNotFoundError,
  NoteMetadataValidationError,
  NoteNotFoundError,
  NoteParseError,
} from "../../../../domain/note/errors";
import { ImageUrl } from "../../../../domain/note/image-url.vo";
import { NoteSlug } from "../../../../domain/note/note-slug.vo";
import { NoteTitle } from "../../../../domain/note/note-title.vo";
import { Note } from "../../../../domain/note/note.entity";
import { ContentType } from "../../../../domain/shared/content-type.vo";
import { ETag } from "../../../../domain/shared/etag.vo";
import { notesApp } from ".";
import type { IPersisted } from "../../../../domain/shared/persisted.interface";
import type { Root } from "mdast";

const createPersistedNote = (
  id: string,
  slug: string,
  publishedOn: string,
): Note<IPersisted> =>
  Note.reconstruct({
    id,
    title: NoteTitle.create(`Title for ${slug}`),
    slug: NoteSlug.create(slug),
    etag: ETag.create("etag-1"),
    imageUrl: ImageUrl.create("https://example.com/image.png"),
    summary: "Test summary",
    publishedOn: Temporal.PlainDate.from(publishedOn),
    lastModifiedOn: Temporal.PlainDate.from("2026-02-18"),
    createdAt: Temporal.Instant.from("2026-01-01T00:00:00Z"),
    updatedAt: Temporal.Instant.from("2026-01-01T00:00:00Z"),
  });

const mockFindPaginated = vi.fn();
const mockUseCaseExecute = vi.fn();
const mockAssetStorageGet = vi.fn();

// Mock drizzle
vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => ({})),
}));

// Mock NotesRefreshService
vi.mock("../../../../services/notes-refresh.service", () => ({
  NotesRefreshService: vi.fn(function (this: unknown) {
    return {
      execute: vi.fn().mockResolvedValue({
        added: 3,
        updated: 2,
        deleted: 1,
      }),
    };
  }),
}));

// Mock query repository
vi.mock("../../../../infra/d1/note/note.query-repository", () => ({
  NoteQueryRepository: vi.fn(function (this: unknown) {
    return {
      findAll: vi.fn(),
      findBySlug: vi.fn(),
      findPaginated: mockFindPaginated,
    };
  }),
}));

// Mock command repository
vi.mock("../../../../infra/d1/note/note.command-repository", () => ({
  NoteCommandRepository: vi.fn(function (this: unknown) {
    return {
      save: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
      deleteBySlug: vi.fn(),
    };
  }),
}));

// Mock storage
vi.mock("../../../../infra/r2/note/markdown.storage", () => ({
  MarkdownStorage: vi.fn(function (this: unknown) {
    return {
      get: vi.fn(),
      list: vi.fn(),
    };
  }),
}));

// Mock GetNoteDetailUseCase
vi.mock("../../../../domain/note/usecases/get-note-detail.usecase", () => ({
  GetNoteDetailUseCase: vi.fn(function (this: unknown) {
    return {
      execute: mockUseCaseExecute,
    };
  }),
}));

// Mock AssetStorage
vi.mock("../../../../infra/r2/note/asset.storage", () => ({
  AssetStorage: vi.fn(function (this: unknown) {
    return {
      get: mockAssetStorageGet,
      list: vi.fn(),
    };
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const parseJson = async (res: Response): Promise<any> => res.json();

const createApp = (): Hono<{ Bindings: Env }> =>
  new Hono<{ Bindings: Env }>().route("/api/v1/notes", notesApp);

const testEnv = {
  D1: {} as D1Database,
  R2: {} as R2Bucket,
  VALUE_FROM_CLOUDFLARE: "test",
};

describe("Notes API Handler", () => {
  describe("POST /api/v1/notes/refresh", () => {
    it("成功時に追加・更新・削除件数を含む JSON レスポンスを 200 で返す", async () => {
      const app = createApp();

      const res = await app.request(
        "/api/v1/notes/refresh",
        { method: "POST" },
        testEnv,
      );

      expect(res.status).toBe(200);
      const json = await parseJson(res);
      expect(json).toMatchObject({
        added: 3,
        updated: 2,
        deleted: 1,
      });
    });

    it("エラー時に RFC 9457 形式のレスポンスを 500 で返す", async () => {
      const { NotesRefreshService: service } =
        await import("../../../../services/notes-refresh.service");

      vi.mocked(service).mockImplementationOnce(function (this: unknown) {
        return {
          execute: vi.fn().mockRejectedValue(new Error("Refresh failed")),
        };
      });

      const app = createApp();

      const res = await app.request(
        "/api/v1/notes/refresh",
        { method: "POST" },
        testEnv,
      );

      expect(res.status).toBe(500);
      expect(res.headers.get("Content-Type")).toContain(
        "application/problem+json",
      );
      const json = await parseJson(res);
      expect(json).toMatchObject({
        type: "about:blank",
        title: "Internal Server Error",
        status: 500,
        detail: "Refresh failed",
      });
    });

    it("NoteParseError 時に 422 Unprocessable Entity を返す", async () => {
      const { NotesRefreshService: service } =
        await import("../../../../services/notes-refresh.service");

      vi.mocked(service).mockImplementationOnce(function (this: unknown) {
        return {
          execute: vi
            .fn()
            .mockRejectedValue(new NoteParseError("broken-article")),
        };
      });

      const app = createApp();

      const res = await app.request(
        "/api/v1/notes/refresh",
        { method: "POST" },
        testEnv,
      );

      expect(res.status).toBe(422);
      expect(res.headers.get("Content-Type")).toContain(
        "application/problem+json",
      );
      const json = await parseJson(res);
      expect(json).toMatchObject({
        type: "about:blank",
        title: "Unprocessable Entity",
        status: 422,
      });
      expect(json.detail).toContain("broken-article");
    });

    it("InvalidNoteSlugError 時に 422 Unprocessable Entity を返す", async () => {
      const { NotesRefreshService: service } =
        await import("../../../../services/notes-refresh.service");

      vi.mocked(service).mockImplementationOnce(function (this: unknown) {
        return {
          execute: vi
            .fn()
            .mockRejectedValue(new InvalidNoteSlugError("bad/slug")),
        };
      });

      const app = createApp();

      const res = await app.request(
        "/api/v1/notes/refresh",
        { method: "POST" },
        testEnv,
      );

      expect(res.status).toBe(422);
      expect(res.headers.get("Content-Type")).toContain(
        "application/problem+json",
      );
      const json = await parseJson(res);
      expect(json).toMatchObject({
        type: "about:blank",
        title: "Unprocessable Entity",
        status: 422,
      });
      expect(json.detail).toContain("bad/slug");
    });

    it("NoteMetadataValidationError 時に 422 Unprocessable Entity を返す", async () => {
      const { NotesRefreshService: service } =
        await import("../../../../services/notes-refresh.service");

      vi.mocked(service).mockImplementationOnce(function (this: unknown) {
        return {
          execute: vi
            .fn()
            .mockRejectedValue(
              new NoteMetadataValidationError("bad-article", [
                "title",
                "imageUrl",
              ]),
            ),
        };
      });

      const app = createApp();

      const res = await app.request(
        "/api/v1/notes/refresh",
        { method: "POST" },
        testEnv,
      );

      expect(res.status).toBe(422);
      const json = await parseJson(res);
      expect(json).toMatchObject({
        type: "about:blank",
        title: "Unprocessable Entity",
        status: 422,
      });
      expect(json.detail).toContain("title");
      expect(json.detail).toContain("imageUrl");
    });
  });

  describe("GET /api/v1/notes", () => {
    it("デフォルトパラメータで記事一覧を 200 で返す", async () => {
      const note = createPersistedNote("id-1", "test-slug", "2026-02-17");
      mockFindPaginated.mockResolvedValue({
        items: [note],
        pagination: { page: 1, perPage: 20, totalCount: 1, totalPages: 1 },
      });

      const app = createApp();
      const res = await app.request(
        "/api/v1/notes",
        { method: "GET" },
        testEnv,
      );

      expect(res.status).toBe(200);
      const json = await parseJson(res);
      expect(json).toMatchObject({
        notes: [
          {
            id: "id-1",
            title: "Title for test-slug",
            slug: "test-slug",
            imageUrl: "https://example.com/image.png",
            summary: "Test summary",
            publishedOn: "2026-02-17",
            lastModifiedOn: "2026-02-18",
          },
        ],
        pagination: {
          page: 1,
          perPage: 20,
          totalCount: 1,
          totalPages: 1,
        },
      });
    });

    it("レスポンスの Content-Type が application/json を含む", async () => {
      mockFindPaginated.mockResolvedValue({
        items: [],
        pagination: { page: 1, perPage: 20, totalCount: 0, totalPages: 0 },
      });

      const app = createApp();
      const res = await app.request(
        "/api/v1/notes",
        { method: "GET" },
        testEnv,
      );

      expect(res.headers.get("Content-Type")).toContain("application/json");
    });

    it("page と per-page クエリパラメータを受け取る", async () => {
      mockFindPaginated.mockResolvedValue({
        items: [],
        pagination: { page: 2, perPage: 10, totalCount: 15, totalPages: 2 },
      });

      const app = createApp();
      const res = await app.request(
        "/api/v1/notes?page=2&per-page=10",
        { method: "GET" },
        testEnv,
      );

      expect(res.status).toBe(200);
      const json = await parseJson(res);
      expect(json.pagination).toMatchObject({
        page: 2,
        perPage: 10,
        totalCount: 15,
        totalPages: 2,
      });
    });

    it("notes 配列に必要なフィールドのみ含み etag, createdAt, updatedAt を除外する", async () => {
      const note = createPersistedNote("id-1", "test-slug", "2026-02-17");
      mockFindPaginated.mockResolvedValue({
        items: [note],
        pagination: { page: 1, perPage: 20, totalCount: 1, totalPages: 1 },
      });

      const app = createApp();
      const res = await app.request(
        "/api/v1/notes",
        { method: "GET" },
        testEnv,
      );
      const json = await parseJson(res);

      const noteItem = json.notes[0];
      expect(noteItem).toHaveProperty("id");
      expect(noteItem).toHaveProperty("title");
      expect(noteItem).toHaveProperty("slug");
      expect(noteItem).toHaveProperty("imageUrl");
      expect(noteItem).toHaveProperty("summary");
      expect(noteItem).toHaveProperty("publishedOn");
      expect(noteItem).toHaveProperty("lastModifiedOn");
      expect(noteItem).not.toHaveProperty("etag");
      expect(noteItem).not.toHaveProperty("createdAt");
      expect(noteItem).not.toHaveProperty("updatedAt");
    });

    it("日付フィールドが ISO 8601 形式 (YYYY-MM-DD) で返却される", async () => {
      const note = createPersistedNote("id-1", "test-slug", "2026-02-17");
      mockFindPaginated.mockResolvedValue({
        items: [note],
        pagination: { page: 1, perPage: 20, totalCount: 1, totalPages: 1 },
      });

      const app = createApp();
      const res = await app.request(
        "/api/v1/notes",
        { method: "GET" },
        testEnv,
      );
      const json = await parseJson(res);

      expect(json.notes[0].publishedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(json.notes[0].lastModifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("範囲外ページ指定時に空配列と正確なメタデータを返す", async () => {
      mockFindPaginated.mockResolvedValue({
        items: [],
        pagination: { page: 100, perPage: 20, totalCount: 5, totalPages: 1 },
      });

      const app = createApp();
      const res = await app.request(
        "/api/v1/notes?page=100",
        { method: "GET" },
        testEnv,
      );

      expect(res.status).toBe(200);
      const json = await parseJson(res);
      expect(json.notes).toEqual([]);
      expect(json.pagination.totalCount).toBe(5);
    });

    describe("バリデーションエラー", () => {
      it("page が不正な値の場合 400 ProblemDetails を返す", async () => {
        const app = createApp();
        const res = await app.request(
          "/api/v1/notes?page=abc",
          { method: "GET" },
          testEnv,
        );

        expect(res.status).toBe(400);
        expect(res.headers.get("Content-Type")).toContain(
          "application/problem+json",
        );
        const json = await parseJson(res);
        expect(json).toMatchObject({
          type: "about:blank",
          title: "Bad Request",
          status: 400,
        });
        expect(json.detail).toContain("page");
      });

      it("per-page が不正な値の場合 400 ProblemDetails を返す", async () => {
        const app = createApp();
        const res = await app.request(
          "/api/v1/notes?per-page=-1",
          { method: "GET" },
          testEnv,
        );

        expect(res.status).toBe(400);
        const json = await parseJson(res);
        expect(json).toMatchObject({
          type: "about:blank",
          title: "Bad Request",
          status: 400,
        });
        expect(json.detail).toContain("per-page");
      });

      it("per-page が最大値 (100) を超える場合 400 ProblemDetails を返す", async () => {
        const app = createApp();
        const res = await app.request(
          "/api/v1/notes?per-page=101",
          { method: "GET" },
          testEnv,
        );

        expect(res.status).toBe(400);
        const json = await parseJson(res);
        expect(json).toMatchObject({
          type: "about:blank",
          title: "Bad Request",
          status: 400,
        });
        expect(json.detail).toContain("per-page");
      });

      it("page が 0 の場合 400 ProblemDetails を返す", async () => {
        const app = createApp();
        const res = await app.request(
          "/api/v1/notes?page=0",
          { method: "GET" },
          testEnv,
        );

        expect(res.status).toBe(400);
        const json = await parseJson(res);
        expect(json.status).toBe(400);
      });
    });

    describe("データベースエラー", () => {
      it("DB エラー時に 500 ProblemDetails を返す", async () => {
        mockFindPaginated.mockRejectedValue(
          new Error("Database connection failed"),
        );
        const consoleErrorSpy = vi
          .spyOn(console, "error")
          .mockImplementation(vi.fn());

        const app = createApp();
        const res = await app.request(
          "/api/v1/notes",
          { method: "GET" },
          testEnv,
        );

        expect(res.status).toBe(500);
        expect(res.headers.get("Content-Type")).toContain(
          "application/problem+json",
        );
        const json = await parseJson(res);
        expect(json).toMatchObject({
          type: "about:blank",
          title: "Internal Server Error",
          status: 500,
        });

        consoleErrorSpy.mockRestore();
      });

      it("DB エラー時に console.error でログ出力する", async () => {
        const dbError = new Error("Database connection failed");
        mockFindPaginated.mockRejectedValue(dbError);
        const consoleErrorSpy = vi
          .spyOn(console, "error")
          .mockImplementation(vi.fn());

        const app = createApp();
        await app.request("/api/v1/notes", { method: "GET" }, testEnv);

        expect(consoleErrorSpy).toHaveBeenCalled();

        consoleErrorSpy.mockRestore();
      });
    });
  });

  describe("GET /api/v1/notes/:noteSlug (記事詳細)", () => {
    const mockMdastRoot: Root = {
      type: "root",
      children: [
        {
          type: "heading",
          depth: 1,
          children: [{ type: "text", value: "Hello" }],
        },
      ],
    };

    it("正常レスポンスを 200 JSON で返す", async () => {
      mockUseCaseExecute.mockResolvedValue({
        id: "note-123",
        title: "My Article",
        slug: "my-article",
        imageUrl: "https://example.com/cover.png",
        publishedOn: "2026-02-15",
        lastModifiedOn: "2026-02-18",
        content: mockMdastRoot,
      });

      const app = createApp();
      const res = await app.request(
        "/api/v1/notes/my-article",
        { method: "GET" },
        testEnv,
      );

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toContain("application/json");
      const json = await parseJson(res);
      expect(json).toMatchObject({
        id: "note-123",
        title: "My Article",
        slug: "my-article",
        imageUrl: "https://example.com/cover.png",
        publishedOn: "2026-02-15",
        lastModifiedOn: "2026-02-18",
        content: { type: "root" },
      });
    });

    it("不正な slug 形式の場合 400 ProblemDetails を返す", async () => {
      const app = createApp();
      const res = await app.request(
        "/api/v1/notes/INVALID SLUG!",
        { method: "GET" },
        testEnv,
      );

      expect(res.status).toBe(400);
      expect(res.headers.get("Content-Type")).toContain(
        "application/problem+json",
      );
      const json = await parseJson(res);
      expect(json).toMatchObject({
        type: "about:blank",
        title: "Bad Request",
        status: 400,
      });
    });

    it("記事が DB に存在しない場合 404 ProblemDetails を返す", async () => {
      mockUseCaseExecute.mockRejectedValue(
        new NoteNotFoundError("nonexistent"),
      );

      const app = createApp();
      const res = await app.request(
        "/api/v1/notes/nonexistent",
        { method: "GET" },
        testEnv,
      );

      expect(res.status).toBe(404);
      expect(res.headers.get("Content-Type")).toContain(
        "application/problem+json",
      );
      const json = await parseJson(res);
      expect(json).toMatchObject({
        type: "about:blank",
        title: "Not Found",
        status: 404,
      });
    });

    it("Markdown がストレージに存在しない場合 404 ProblemDetails を返す", async () => {
      mockUseCaseExecute.mockRejectedValue(
        new MarkdownNotFoundError("my-article"),
      );

      const app = createApp();
      const res = await app.request(
        "/api/v1/notes/my-article",
        { method: "GET" },
        testEnv,
      );

      expect(res.status).toBe(404);
      expect(res.headers.get("Content-Type")).toContain(
        "application/problem+json",
      );
      const json = await parseJson(res);
      expect(json).toMatchObject({
        type: "about:blank",
        title: "Not Found",
        status: 404,
      });
    });

    it("内部エラー時に 500 ProblemDetails を返す", async () => {
      mockUseCaseExecute.mockRejectedValue(new Error("DB connection failed"));
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(vi.fn());

      const app = createApp();
      const res = await app.request(
        "/api/v1/notes/my-article",
        { method: "GET" },
        testEnv,
      );

      expect(res.status).toBe(500);
      expect(res.headers.get("Content-Type")).toContain(
        "application/problem+json",
      );
      const json = await parseJson(res);
      expect(json).toMatchObject({
        type: "about:blank",
        title: "Internal Server Error",
        status: 500,
      });

      consoleErrorSpy.mockRestore();
    });

    it("内部エラー時に console.error でログ出力する", async () => {
      mockUseCaseExecute.mockRejectedValue(new Error("Unexpected error"));
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(vi.fn());

      const app = createApp();
      await app.request("/api/v1/notes/my-article", { method: "GET" }, testEnv);

      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });

  describe("GET /api/v1/notes/:noteSlug/assets/* (アセット配信)", () => {
    it("アセットをバイナリストリームで返す", async () => {
      const binaryData = new Uint8Array([137, 80, 78, 71]);
      const stream = new ReadableStream({
        start(controller): void {
          controller.enqueue(binaryData);
          controller.close();
        },
      });

      mockAssetStorageGet.mockResolvedValue({
        body: stream,
        contentType: ContentType.create("image/png"),
        size: 4,
        etag: ETag.create("etag-asset-1"),
      });

      const app = createApp();
      const res = await app.request(
        "/api/v1/notes/my-article/assets/images/diagram.png",
        { method: "GET" },
        testEnv,
      );

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/png");
      expect(res.headers.get("ETag")).toBe("etag-asset-1");

      const buffer = await res.arrayBuffer();
      expect(new Uint8Array(buffer)).toEqual(binaryData);
    });

    it("不正な slug 形式の場合 400 ProblemDetails を返す", async () => {
      const app = createApp();
      const res = await app.request(
        "/api/v1/notes/INVALID SLUG!/assets/image.png",
        { method: "GET" },
        testEnv,
      );

      expect(res.status).toBe(400);
      expect(res.headers.get("Content-Type")).toContain(
        "application/problem+json",
      );
      const json = await parseJson(res);
      expect(json).toMatchObject({
        type: "about:blank",
        title: "Bad Request",
        status: 400,
      });
    });

    it("アセットが見つからない場合 404 ProblemDetails を返す", async () => {
      // eslint-disable-next-line unicorn/no-useless-undefined
      mockAssetStorageGet.mockResolvedValue(undefined);

      const app = createApp();
      const res = await app.request(
        "/api/v1/notes/my-article/assets/nonexistent.png",
        { method: "GET" },
        testEnv,
      );

      expect(res.status).toBe(404);
      expect(res.headers.get("Content-Type")).toContain(
        "application/problem+json",
      );
      const json = await parseJson(res);
      expect(json).toMatchObject({
        type: "about:blank",
        title: "Not Found",
        status: 404,
      });
    });

    it("内部エラー時に 500 ProblemDetails を返す", async () => {
      mockAssetStorageGet.mockRejectedValue(new Error("R2 access failed"));
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(vi.fn());

      const app = createApp();
      const res = await app.request(
        "/api/v1/notes/my-article/assets/image.png",
        { method: "GET" },
        testEnv,
      );

      expect(res.status).toBe(500);
      expect(res.headers.get("Content-Type")).toContain(
        "application/problem+json",
      );
      const json = await parseJson(res);
      expect(json).toMatchObject({
        type: "about:blank",
        title: "Internal Server Error",
        status: 500,
      });

      consoleErrorSpy.mockRestore();
    });

    it("内部エラー時に console.error でログ出力する", async () => {
      mockAssetStorageGet.mockRejectedValue(new Error("R2 error"));
      const consoleErrorSpy = vi
        .spyOn(console, "error")
        .mockImplementation(vi.fn());

      const app = createApp();
      await app.request(
        "/api/v1/notes/my-article/assets/image.png",
        { method: "GET" },
        testEnv,
      );

      expect(consoleErrorSpy).toHaveBeenCalled();

      consoleErrorSpy.mockRestore();
    });
  });
});
