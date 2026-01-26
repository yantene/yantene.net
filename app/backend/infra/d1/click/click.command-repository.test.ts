import { Temporal } from "@js-temporal/polyfill";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Click } from "../../../domain/click/click.entity";
import { ClickCommandRepository } from "./click.command-repository";
import type { DrizzleD1Database } from "drizzle-orm/d1";

function createMockDb(): DrizzleD1Database & {
  _mockGet: ReturnType<typeof vi.fn>;
  _mockValues: ReturnType<typeof vi.fn>;
} {
  const mockGet = vi.fn();
  const mockFrom = vi.fn(() => ({ get: mockGet }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));
  const mockReturning = vi.fn(() => ({ get: mockGet }));
  const mockValues = vi.fn(() => ({ returning: mockReturning }));
  const mockInsert = vi.fn(() => ({ values: mockValues }));

  return {
    select: mockSelect,
    insert: mockInsert,
    _mockGet: mockGet,
    _mockValues: mockValues,
  } as unknown as DrizzleD1Database & {
    _mockGet: ReturnType<typeof vi.fn>;
    _mockValues: ReturnType<typeof vi.fn>;
  };
}

describe("ClickCommandRepository", () => {
  let db: ReturnType<typeof createMockDb>;
  let repository: ClickCommandRepository;

  beforeEach(() => {
    db = createMockDb();
    repository = new ClickCommandRepository(db);
    vi.stubGlobal("crypto", { randomUUID: () => "test-uuid-1234" });
  });

  // eslint-disable-next-line no-secrets/no-secrets
  it("should be a class that implements IClickCommandRepository", () => {
    const saveFn = ClickCommandRepository.prototype.save;
    const countFn = ClickCommandRepository.prototype.count;

    expect(ClickCommandRepository).toBeDefined();
    expect(saveFn).toBeDefined();
    expect(countFn).toBeDefined();
  });

  describe("save()", () => {
    it("should insert click data and return persisted entity", async () => {
      const click = Click.create({ timestamp: 1000 });
      const now = Temporal.Now.instant();

      db._mockGet.mockResolvedValue({
        id: "test-uuid-1234",
        timestamp: 1000,
        createdAt: now,
        updatedAt: now,
      });

      const result = await repository.save(click);

      expect(result.id).toBe("test-uuid-1234");
      expect(result.timestamp).toBe(1000);
      expect(result.createdAt).toBe(now);
      expect(result.updatedAt).toBe(now);

      expect(db._mockValues).toHaveBeenCalledWith({
        id: "test-uuid-1234",
        timestamp: 1000,
      });
    });
  });

  describe("count()", () => {
    it("should return the count from the database", async () => {
      db._mockGet.mockResolvedValue({ count: 42 });

      const result = await repository.count();

      expect(result).toBe(42);
    });

    it("should return 0 when result is null", async () => {
      db._mockGet.mockResolvedValue(null);

      const result = await repository.count();

      expect(result).toBe(0);
    });
  });
});
