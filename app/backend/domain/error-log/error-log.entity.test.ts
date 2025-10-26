import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { ErrorLog } from "./error-log.entity";
import { LogLevel } from "./log-level.vo";

describe("ErrorLog", () => {
  describe("create", () => {
    it("should create unpersisted ErrorLog with required fields", () => {
      const errorLog = ErrorLog.create({
        level: LogLevel.create("error"),
        message: "Test error message",
      });

      expect(errorLog.id).toBeUndefined();
      expect(errorLog.level.value).toBe("error");
      expect(errorLog.message).toBe("Test error message");
      expect(errorLog.stack).toBeUndefined();
      expect(errorLog.context).toBeUndefined();
      expect(errorLog.createdAt).toBeUndefined();
      expect(errorLog.updatedAt).toBeUndefined();
    });

    it("should create ErrorLog with all fields", () => {
      const errorLog = ErrorLog.create({
        level: LogLevel.create("fatal"),
        message: "Fatal error",
        stack: "Error: Fatal error\n    at Object.<anonymous>",
        context: '{"userId": "123"}',
      });

      expect(errorLog.level.value).toBe("fatal");
      expect(errorLog.message).toBe("Fatal error");
      expect(errorLog.stack).toBe(
        "Error: Fatal error\n    at Object.<anonymous>",
      );
      expect(errorLog.context).toBe('{"userId": "123"}');
    });

    it("should handle undefined optional fields", () => {
      const errorLog = ErrorLog.create({
        level: LogLevel.create("warn"),
        message: "Warning",
        stack: undefined,
        context: undefined,
      });

      expect(errorLog.stack).toBeUndefined();
      expect(errorLog.context).toBeUndefined();
    });
  });

  describe("reconstruct", () => {
    it("should reconstruct persisted ErrorLog", () => {
      const now = Temporal.Now.instant();
      const errorLog = ErrorLog.reconstruct({
        id: "test-id",
        level: LogLevel.create("info"),
        message: "Info message",
        stack: undefined,
        context: undefined,
        createdAt: now,
        updatedAt: now,
      });

      expect(errorLog.id).toBe("test-id");
      expect(errorLog.level.value).toBe("info");
      expect(errorLog.message).toBe("Info message");
      expect(errorLog.stack).toBeUndefined();
      expect(errorLog.context).toBeUndefined();
      expect(errorLog.createdAt).toBe(now);
      expect(errorLog.updatedAt).toBe(now);
    });

    it("should reconstruct ErrorLog with all fields", () => {
      const createdAt = Temporal.Instant.fromEpochMilliseconds(1000000000000);
      const updatedAt = Temporal.Instant.fromEpochMilliseconds(1000000001000);

      const errorLog = ErrorLog.reconstruct({
        id: "abc-123",
        level: LogLevel.create("debug"),
        message: "Debug message",
        stack: "Stack trace here",
        context: '{"key": "value"}',
        createdAt,
        updatedAt,
      });

      expect(errorLog.id).toBe("abc-123");
      expect(errorLog.level.value).toBe("debug");
      expect(errorLog.message).toBe("Debug message");
      expect(errorLog.stack).toBe("Stack trace here");
      expect(errorLog.context).toBe('{"key": "value"}');
      expect(errorLog.createdAt).toBe(createdAt);
      expect(errorLog.updatedAt).toBe(updatedAt);
    });
  });

  describe("equals", () => {
    it("should return true for ErrorLogs with same id", () => {
      const now = Temporal.Now.instant();
      const errorLog1 = ErrorLog.reconstruct({
        id: "same-id",
        level: LogLevel.create("error"),
        message: "Message 1",
        stack: undefined,
        context: undefined,
        createdAt: now,
        updatedAt: now,
      });

      const errorLog2 = ErrorLog.reconstruct({
        id: "same-id",
        level: LogLevel.create("warn"),
        message: "Message 2",
        stack: undefined,
        context: undefined,
        createdAt: now,
        updatedAt: now,
      });

      expect(errorLog1.equals(errorLog2)).toBe(true);
    });

    it("should return false for ErrorLogs with different ids", () => {
      const now = Temporal.Now.instant();
      const errorLog1 = ErrorLog.reconstruct({
        id: "id-1",
        level: LogLevel.create("error"),
        message: "Same message",
        stack: undefined,
        context: undefined,
        createdAt: now,
        updatedAt: now,
      });

      const errorLog2 = ErrorLog.reconstruct({
        id: "id-2",
        level: LogLevel.create("error"),
        message: "Same message",
        stack: undefined,
        context: undefined,
        createdAt: now,
        updatedAt: now,
      });

      expect(errorLog1.equals(errorLog2)).toBe(false);
    });

    it("should handle unpersisted ErrorLogs", () => {
      const errorLog1 = ErrorLog.create({
        level: LogLevel.create("error"),
        message: "Message",
      });

      const errorLog2 = ErrorLog.create({
        level: LogLevel.create("error"),
        message: "Message",
      });

      // Both have id: undefined, so equals should return true
      expect(errorLog1.equals(errorLog2)).toBe(true);
    });
  });

  describe("toJSON", () => {
    it("should serialize unpersisted ErrorLog", () => {
      const errorLog = ErrorLog.create({
        level: LogLevel.create("error"),
        message: "Error message",
        stack: "Stack trace",
        context: '{"data": true}',
      });

      const json = errorLog.toJSON();

      expect(json).toEqual({
        id: undefined,
        level: "error",
        message: "Error message",
        stack: "Stack trace",
        context: '{"data": true}',
        createdAt: undefined,
        updatedAt: undefined,
      });
    });

    it("should serialize persisted ErrorLog", () => {
      const createdAt = Temporal.Instant.fromEpochMilliseconds(1000000000000);
      const updatedAt = Temporal.Instant.fromEpochMilliseconds(1000000001000);

      const errorLog = ErrorLog.reconstruct({
        id: "test-id",
        level: LogLevel.create("warn"),
        message: "Warning message",
        stack: undefined,
        context: undefined,
        createdAt,
        updatedAt,
      });

      const json = errorLog.toJSON();

      expect(json).toEqual({
        id: "test-id",
        level: "warn",
        message: "Warning message",
        stack: undefined,
        context: undefined,
        createdAt: createdAt.toString(),
        updatedAt: updatedAt.toString(),
      });
    });

    it("should handle all log levels", () => {
      const levels = ["debug", "info", "warn", "error", "fatal"] as const;

      for (const level of levels) {
        const errorLog = ErrorLog.create({
          level: LogLevel.create(level),
          message: "Test",
        });

        const json = errorLog.toJSON();
        expect(json.level).toBe(level);
      }
    });
  });
});
