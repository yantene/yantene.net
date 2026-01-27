import { describe, expect, it } from "vitest";
import { ContentType } from "./content-type.vo";

describe("ContentType Value Object", () => {
  describe("create()", () => {
    it("should create a ContentType with a valid MIME type", () => {
      const contentType = ContentType.create("image/png");

      expect(contentType.value).toBe("image/png");
    });

    it("should create a ContentType with text/markdown", () => {
      const contentType = ContentType.create("text/markdown");

      expect(contentType.value).toBe("text/markdown");
    });

    it("should throw an error for an empty string", () => {
      expect(() => ContentType.create("")).toThrow("Invalid content type");
    });
  });

  describe("equals()", () => {
    it("should return true for ContentTypes with the same value", () => {
      const ct1 = ContentType.create("image/png");
      const ct2 = ContentType.create("image/png");

      expect(ct1.equals(ct2)).toBe(true);
    });

    it("should return false for ContentTypes with different values", () => {
      const ct1 = ContentType.create("image/png");
      const ct2 = ContentType.create("text/markdown");

      expect(ct1.equals(ct2)).toBe(false);
    });
  });

  describe("toJSON()", () => {
    it("should return the string value", () => {
      const contentType = ContentType.create("image/jpeg");

      expect(contentType.toJSON()).toBe("image/jpeg");
    });
  });

  describe("isImage()", () => {
    it("should return true for image/png", () => {
      const contentType = ContentType.create("image/png");

      expect(contentType.isImage()).toBe(true);
    });

    it("should return true for image/jpeg", () => {
      const contentType = ContentType.create("image/jpeg");

      expect(contentType.isImage()).toBe(true);
    });

    it("should return true for image/gif", () => {
      const contentType = ContentType.create("image/gif");

      expect(contentType.isImage()).toBe(true);
    });

    it("should return true for image/webp", () => {
      const contentType = ContentType.create("image/webp");

      expect(contentType.isImage()).toBe(true);
    });

    it("should return false for text/markdown", () => {
      const contentType = ContentType.create("text/markdown");

      expect(contentType.isImage()).toBe(false);
    });

    it("should return false for application/json", () => {
      const contentType = ContentType.create("application/json");

      expect(contentType.isImage()).toBe(false);
    });
  });

  describe("isMarkdown()", () => {
    it("should return true for text/markdown", () => {
      const contentType = ContentType.create("text/markdown");

      expect(contentType.isMarkdown()).toBe(true);
    });

    it("should return false for image/png", () => {
      const contentType = ContentType.create("image/png");

      expect(contentType.isMarkdown()).toBe(false);
    });

    it("should return false for text/plain", () => {
      const contentType = ContentType.create("text/plain");

      expect(contentType.isMarkdown()).toBe(false);
    });
  });
});
