import { describe, expect, it } from "vitest";
import { LogLevel } from "./log-level.vo";

describe("LogLevel", () => {
  describe("create", () => {
    it("should create LogLevel with valid level", () => {
      const levels = ["debug", "info", "warn", "error", "fatal"] as const;

      for (const level of levels) {
        const logLevel = LogLevel.create(level);
        expect(logLevel.value).toBe(level);
      }
    });

    it("should throw error for invalid level", () => {
      const invalidLevels = ["trace", "critical", "WARN", "Error", ""];

      for (const level of invalidLevels) {
        expect(() => LogLevel.create(level)).toThrow(
          `Invalid log level: ${level}`,
        );
      }
    });
  });

  describe("equals", () => {
    it("should return true for same level", () => {
      const level1 = LogLevel.create("error");
      const level2 = LogLevel.create("error");

      expect(level1.equals(level2)).toBe(true);
    });

    it("should return false for different levels", () => {
      const level1 = LogLevel.create("error");
      const level2 = LogLevel.create("warn");

      expect(level1.equals(level2)).toBe(false);
    });
  });

  describe("toJSON", () => {
    it("should return string value", () => {
      const levels = ["debug", "info", "warn", "error", "fatal"] as const;

      for (const level of levels) {
        const logLevel = LogLevel.create(level);
        expect(logLevel.toJSON()).toBe(level);
        expect(typeof logLevel.toJSON()).toBe("string");
      }
    });
  });
});
