import { Temporal } from "@js-temporal/polyfill";
import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { ImageUrl } from "../../../../domain/note/image-url.vo";
import { NoteSlug } from "../../../../domain/note/note-slug.vo";
import { NoteTitle } from "../../../../domain/note/note-title.vo";
import { Note } from "../../../../domain/note/note.entity";
import { ETag } from "../../../../domain/shared/etag.vo";
import { notesApp } from ".";
import type { IPersisted } from "../../../../domain/persisted.interface";

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
    publishedOn: Temporal.PlainDate.from(publishedOn),
    lastModifiedOn: Temporal.PlainDate.from("2026-02-18"),
    createdAt: Temporal.Instant.from("2026-01-01T00:00:00Z"),
    updatedAt: Temporal.Instant.from("2026-01-01T00:00:00Z"),
  });

const mockFindPaginated = vi.fn();

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
});
