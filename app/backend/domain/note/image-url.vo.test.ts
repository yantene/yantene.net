import { describe, expect, it } from "vitest";
import { ImageUrl } from "./image-url.vo";

describe("ImageUrl Value Object", () => {
  describe("create()", () => {
    it("should create an ImageUrl with a valid URL", () => {
      const imageUrl = ImageUrl.create("https://example.com/image.png");

      expect(imageUrl.value).toBe("https://example.com/image.png");
    });

    it("should create an ImageUrl with an HTTP URL", () => {
      const imageUrl = ImageUrl.create("http://example.com/photo.jpg");

      expect(imageUrl.value).toBe("http://example.com/photo.jpg");
    });

    it("should create an ImageUrl with a URL containing query parameters", () => {
      const imageUrl = ImageUrl.create(
        "https://example.com/image.png?width=800&height=600",
      );

      expect(imageUrl.value).toBe(
        "https://example.com/image.png?width=800&height=600",
      );
    });

    it("should throw an error for an empty string", () => {
      expect(() => ImageUrl.create("")).toThrow("Invalid image url: ");
    });

    it("should throw an error for an invalid URL format", () => {
      expect(() => ImageUrl.create("not-a-url")).toThrow(
        "Invalid image url: not-a-url",
      );
    });

    it("should throw an error for a string without protocol", () => {
      expect(() => ImageUrl.create("example.com/image.png")).toThrow(
        "Invalid image url: example.com/image.png",
      );
    });
  });

  describe("equals()", () => {
    it("should return true for ImageUrls with the same value", () => {
      const imageUrl1 = ImageUrl.create("https://example.com/image.png");
      const imageUrl2 = ImageUrl.create("https://example.com/image.png");

      expect(imageUrl1.equals(imageUrl2)).toBe(true);
    });

    it("should return false for ImageUrls with different values", () => {
      const imageUrl1 = ImageUrl.create("https://example.com/image1.png");
      const imageUrl2 = ImageUrl.create("https://example.com/image2.png");

      expect(imageUrl1.equals(imageUrl2)).toBe(false);
    });
  });

  describe("toJSON()", () => {
    it("should return the string value", () => {
      const imageUrl = ImageUrl.create("https://example.com/image.png");

      expect(imageUrl.toJSON()).toBe("https://example.com/image.png");
    });
  });
});
