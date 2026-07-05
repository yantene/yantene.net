import { describe, expect, it } from "vitest";
import { resolveAssetUrl } from "./note-asset-url";

describe("resolveAssetUrl", () => {
  it("resolves ./relative paths to the asset API URL", () => {
    expect(resolveAssetUrl("my-note", "./cover.png")).toBe(
      "/api/v1/notes/my-note/assets/cover.png",
    );
  });

  it("resolves bare relative paths", () => {
    expect(resolveAssetUrl("my-note", "img/a.png")).toBe(
      "/api/v1/notes/my-note/assets/img/a.png",
    );
  });

  it("collapses ./ and ../ segments instead of producing a malformed URL", () => {
    expect(resolveAssetUrl("my-note", "./img/./a.png")).toBe(
      "/api/v1/notes/my-note/assets/img/a.png",
    );
    // ../ は畳まれる (assets/../ のような壊れたパスにはならない)。
    expect(resolveAssetUrl("my-note", "../x.png")).toBe(
      "/api/v1/notes/my-note/x.png",
    );
  });

  it("leaves absolute URLs and root-relative paths untouched", () => {
    expect(resolveAssetUrl("n", "https://example.com/a.png")).toBe(
      "https://example.com/a.png",
    );
    expect(resolveAssetUrl("n", "/already/resolved.png")).toBe(
      "/already/resolved.png",
    );
  });
});
