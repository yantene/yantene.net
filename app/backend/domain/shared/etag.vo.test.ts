import { describe, expect, it } from "vitest";
import { ETag } from "./etag.vo";

describe("ETag Value Object", () => {
  describe("create()", () => {
    it("should create an ETag with a valid value", () => {
      const etag = ETag.create('"abc123"');

      expect(etag.value).toBe('"abc123"');
    });

    it("should create an ETag with a hash value", () => {
      const etag = ETag.create("d41d8cd98f00b204e9800998ecf8427e");

      expect(etag.value).toBe("d41d8cd98f00b204e9800998ecf8427e");
    });

    it("should throw an error for an empty string", () => {
      expect(() => ETag.create("")).toThrow("Invalid etag");
    });
  });

  describe("equals()", () => {
    it("should return true for ETags with the same value", () => {
      const etag1 = ETag.create('"abc123"');
      const etag2 = ETag.create('"abc123"');

      expect(etag1.equals(etag2)).toBe(true);
    });

    it("should return false for ETags with different values", () => {
      const etag1 = ETag.create('"abc123"');
      const etag2 = ETag.create('"def456"');

      expect(etag1.equals(etag2)).toBe(false);
    });
  });

  describe("toJSON()", () => {
    it("should return the string value", () => {
      const etag = ETag.create('"abc123"');

      expect(etag.toJSON()).toBe('"abc123"');
    });
  });
});
