import { Hono } from "hono";
import { describe, expect, it, vi } from "vitest";
import { notesApp } from ".";

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
vi.mock("../../../../infra/r2/stored-object.storage", () => ({
  StoredObjectStorage: vi.fn(function (this: unknown) {
    return {
      get: vi.fn(),
      list: vi.fn(),
    };
  }),
}));

describe("Notes Refresh API Handler", () => {
  describe("POST /api/v1/notes/refresh", () => {
    it("成功時に追加・更新・削除件数を含む JSON レスポンスを 200 で返す", async () => {
      const app = new Hono<{ Bindings: Env }>().route(
        "/api/v1/notes",
        notesApp,
      );

      const res = await app.request(
        "/api/v1/notes/refresh",
        { method: "POST" },
        {
          D1: {} as D1Database,
          R2: {} as R2Bucket,
          VALUE_FROM_CLOUDFLARE: "test",
        },
      );

      expect(res.status).toBe(200);
      const json = await res.json();
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

      const app = new Hono<{ Bindings: Env }>().route(
        "/api/v1/notes",
        notesApp,
      );

      const res = await app.request(
        "/api/v1/notes/refresh",
        { method: "POST" },
        {
          D1: {} as D1Database,
          R2: {} as R2Bucket,
          VALUE_FROM_CLOUDFLARE: "test",
        },
      );

      expect(res.status).toBe(500);
      expect(res.headers.get("Content-Type")).toContain(
        "application/problem+json",
      );
      const json = await res.json();
      expect(json).toMatchObject({
        type: "about:blank",
        title: "Internal Server Error",
        status: 500,
        detail: "Refresh failed",
      });
    });
  });
});
