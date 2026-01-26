import { beforeEach, describe, expect, it, vi } from "vitest";
import { counterApp } from "./index";

const mockCount = vi.fn();
const mockSave = vi.fn();
const mockExecute = vi.fn();

vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => ({})),
}));

vi.mock("../../../infra/d1/click/click.command-repository", () => ({
  ClickCommandRepository: class {
    count = mockCount;
    save = mockSave;
  },
}));

vi.mock("../../../domain/click/usecases/increment-click.usecase", () => ({
  IncrementClickUsecase: class {
    execute = mockExecute;
  },
}));

describe("Counter API Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /", () => {
    it("should return current count on success", async () => {
      mockCount.mockResolvedValue(42);

      const response = await counterApp.request("/", undefined, {
        D1: {},
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ count: 42 });
      expect(mockCount).toHaveBeenCalledOnce();
    });

    it("should return 500 when repository throws", async () => {
      mockCount.mockRejectedValue(new Error("DB error"));

      const response = await counterApp.request("/", undefined, {
        D1: {},
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toEqual({ error: "Failed to fetch counter" });
    });
  });

  describe("POST /increment", () => {
    it("should increment and return new count on success", async () => {
      mockExecute.mockResolvedValue({ count: 5 });

      const response = await counterApp.request(
        "/increment",
        { method: "POST" },
        { D1: {} },
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toEqual({ count: 5 });
      expect(mockExecute).toHaveBeenCalledOnce();
    });

    it("should return 500 when usecase throws", async () => {
      mockExecute.mockRejectedValue(new Error("Increment failed"));

      const response = await counterApp.request(
        "/increment",
        { method: "POST" },
        { D1: {} },
      );

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data).toEqual({ error: "Failed to increment counter" });
    });
  });
});
