/* eslint-disable no-secrets/no-secrets -- MIME タイプ文字列 (application/ld+json) の誤検知。 */
import { describe, expect, it } from "vitest";
import { renderJsonLd } from "./json-ld";

describe("renderJsonLd", () => {
  it("returns an empty string when jsonLd is undefined (no crash)", () => {
    // JSON.stringify(undefined) === undefined を踏むと SSR が 500 になる回帰の防止。
    expect(renderJsonLd(undefined)).toBe("");
  });

  it("wraps the JSON in a ld+json script tag", () => {
    const out = renderJsonLd({ "@type": "BlogPosting", headline: "x" });
    expect(out).toContain('<script type="application/ld+json">');
    expect(out).toContain('"@type":"BlogPosting"');
    expect(out.endsWith("</script>")).toBe(true);
  });

  it("escapes < so a value containing </script> cannot break out", () => {
    const out = renderJsonLd({ x: "</script>" });
    expect(out).toContain(String.raw`\u003c/script>`);
    // 実際の閉じタグは末尾の 1 個だけ。
    expect(out.split("</script>")).toHaveLength(2);
  });
});
