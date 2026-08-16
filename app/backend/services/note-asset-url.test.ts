import { describe, expect, it } from "vitest";
import { assetPrefixOf, resolveAssetUrl } from "./note-asset-url";

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

  it("collapses ./ segments instead of producing a malformed URL", () => {
    expect(resolveAssetUrl("my-note", "./img/./a.png")).toBe(
      "/api/v1/notes/my-note/assets/img/a.png",
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

/*
 * 相対パスでないのに、スキームも `/` も持たないものがある。素朴に判定すると相対パスの
 * 側へ落ちて、assets の入口 (`/api/v1/notes/<slug>/assets/`) を指してしまう (#297)。
 */
describe("resolveAssetUrl: 相対パスでないもの", () => {
  it("ページ内アンカーは触らない", () => {
    // 本文に書いた `[戻る](#top)` や手書きの目次。押すと 404 になっていた。
    expect(resolveAssetUrl("n", "#top")).toBe("#top");
    expect(resolveAssetUrl("n", "#user-content-fn-1")).toBe(
      "#user-content-fn-1",
    );
  });

  it("空の行き先は触らない", () => {
    expect(resolveAssetUrl("n", "")).toBe("");
  });

  /* RFC 3986 では、クエリだけの参照も `#` と同じく同一文書参照。 */
  it("クエリだけの参照は触らない", () => {
    expect(resolveAssetUrl("n", "?tag=music")).toBe("?tag=music");
  });
});

/*
 * クエリと断片は書き手が意図して付けたもの。pathname だけを取ると黙って消える。
 */
describe("resolveAssetUrl: クエリと断片", () => {
  it("断片を残す", () => {
    expect(resolveAssetUrl("n", "./song.mid#bar-32")).toBe(
      "/api/v1/notes/n/assets/song.mid#bar-32",
    );
  });

  it("クエリを残す", () => {
    expect(resolveAssetUrl("n", "./a.png?v=2")).toBe(
      "/api/v1/notes/n/assets/a.png?v=2",
    );
  });

  it("両方あれば両方残す", () => {
    expect(resolveAssetUrl("n", "./a.png?v=2#top")).toBe(
      "/api/v1/notes/n/assets/a.png?v=2#top",
    );
  });
});

/*
 * 寸法表は「解決後の URL」を鍵にしている (notes-refresh.service.ts の cacheAssets)。
 * 本文の側も同じ関数を通るので、符号化の揺れを気にせず突き合わせられる。**名前へ戻す
 * 方向にすると `100%25.png` のような名前が別物に化ける** (#297)。
 */
describe("resolveAssetUrl: 正本の名前と本文の書き方が同じ URL に落ちる", () => {
  it.each([
    ["絵.png", "./絵.png"],
    ["50%off.png", "./50%off.png"],
    ["100%25.png", "./100%25.png"],
    ["img/a.png", "img/./a.png"],
  ])("%s", (relPath, written) => {
    expect(resolveAssetUrl("n", relPath)).toBe(resolveAssetUrl("n", written));
  });
});

/*
 * `../` でアセットの外へ出たものは書き換えない。無関係な API のパスを指す URL を
 * こちらが作り出すより、書いたまま返したほうが出どころが分かる (#297)。
 */
describe("resolveAssetUrl: アセットの外へ出るもの", () => {
  it.each(["../x.png", "../../../x.png", "./sub/../../x"])(
    "%s は触らない",
    (url) => {
      expect(resolveAssetUrl("n", url)).toBe(url);
    },
  );

  it("中で畳まれるだけなら解決する", () => {
    expect(resolveAssetUrl("n", "./img/../a.png")).toBe(
      `${assetPrefixOf("n")}a.png`,
    );
  });
});
