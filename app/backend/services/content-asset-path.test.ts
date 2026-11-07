import { describe, expect, it } from "vitest";
import { isSyncedAssetPath } from "./content-asset-path";

describe("isSyncedAssetPath", () => {
  it("通常のアセットは同期する", () => {
    expect(isSyncedAssetPath("cover.png")).toBe(true);
    expect(isSyncedAssetPath("img/a.png")).toBe(true);
  });

  it("_ で始まる要素を含むパスは、どの深さでも同期しない", () => {
    expect(isSyncedAssetPath("_materials/interview.md")).toBe(false);
    expect(isSyncedAssetPath("img/_draft.png")).toBe(false);
    expect(isSyncedAssetPath("img/_old/a.png")).toBe(false);
    expect(isSyncedAssetPath("_x")).toBe(false);
  });

  it("要素の途中にある _ は見ない", () => {
    expect(isSyncedAssetPath("my_photo.png")).toBe(true);
    expect(isSyncedAssetPath("img/a_b/c.png")).toBe(true);
  });
});
