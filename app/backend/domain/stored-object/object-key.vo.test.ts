import { describe, expect, it } from "vitest";
import { ObjectKey } from "./object-key.vo";

describe("ObjectKey Value Object", () => {
  describe("create()", () => {
    it("should create an ObjectKey with a valid string", () => {
      const objectKey = ObjectKey.create("images/photo.png");

      expect(objectKey.value).toBe("images/photo.png");
    });

    it("should create an ObjectKey with a simple key", () => {
      const objectKey = ObjectKey.create("readme.md");

      expect(objectKey.value).toBe("readme.md");
    });

    it("should throw an error for an empty string", () => {
      expect(() => ObjectKey.create("")).toThrow("Invalid object key");
    });
  });

  describe("equals()", () => {
    it("should return true for ObjectKeys with the same value", () => {
      const key1 = ObjectKey.create("images/photo.png");
      const key2 = ObjectKey.create("images/photo.png");

      expect(key1.equals(key2)).toBe(true);
    });

    it("should return false for ObjectKeys with different values", () => {
      const key1 = ObjectKey.create("images/photo.png");
      const key2 = ObjectKey.create("docs/readme.md");

      expect(key1.equals(key2)).toBe(false);
    });
  });

  describe("toJSON()", () => {
    it("should return the string value", () => {
      const objectKey = ObjectKey.create("images/photo.png");

      expect(objectKey.toJSON()).toBe("images/photo.png");
    });
  });
});
