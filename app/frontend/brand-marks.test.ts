import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * CSS は import ではなく実ファイルから読む (vitest は CSS の import を空にする。理由と
 * 前例は theme-tokens.test.ts / clock-origin.test.ts にある)。
 */
const css = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "brand-marks.css"),
  "utf8",
);

/*
 * 印を描いている場所を、ソース全体から拾う。テストとストーリーは出荷されないので外す。
 *
 * **`.ts` も見る。** 素材の表だけを `.ts` に切り出すのはありそうな整理で、そこを
 * 見ていないと顔ぶれの検査をすり抜ける。
 */
const sources = import.meta.glob<string>(
  [
    "./**/*.ts",
    "./**/*.tsx",
    "!./**/*.test.ts",
    "!./**/*.test.tsx",
    "!./**/*.stories.tsx",
    "!./**/*.d.ts",
  ],
  { query: "?raw", import: "default", eager: true },
);

/**
 * よその会社の印が、周りの字の色を継がないことを見張る。
 *
 * react-icons の素材は `fill="currentColor"` で出るので、**何もしなければ置いた場所の
 * 字の色になる**。このサイトの字は紺 (`--color-base-content`) で、hover では primary に
 * 変わる。どの社も「黒か白以外に染めるな」と言っているので、これが規定違反になる。
 *
 * 実際、出ていく先・共有メニュー・ライセンスのページの 3 か所ともそうなっていた (#512)。
 * 同じことが次に印を足す人にも起きるので、置き忘れをここで落とす。
 *
 * 出典と各社の文言は `brand-marks.css` にある。
 */
describe("ブランドの印", () => {
  it("色を決める規則が黒を指していて、サイトの配色トークンを使っていない", () => {
    expect(css).toMatch(/\.brand-mark\s*\{[^}]*fill:\s*#000\b/);
    expect(css).not.toMatch(/\.brand-mark[^{]*\{[^}]*var\(--color-/);
  });

  it("hover でも色が変わらない", () => {
    expect(css).toMatch(/a:hover > \.brand-mark/);
    expect(css).toMatch(/button:hover > \.brand-mark/);
  });

  /*
   * `react-icons/si` (Simple Icons) から持ってきた素材は、すべてよその会社の印である。
   *
   * **素材の名前は import 文から取る。** `<Si[A-Za-z]+` のような綴りで JSX を探すと、
   * `<SignInForm` のような無関係な部品まで拾う (実際に拾った)。
   */
  const brandFiles = Object.entries(sources)
    .map(([file, code]) => {
      const imports = [...code.matchAll(/import\s*\{([^}]*)\}\s*from\s*"react-icons\/si"/g)];
      const names = imports.flatMap((m) =>
        m[1]
          .split(",")
          .map((name) => name.trim())
          .filter((name) => name.length > 0),
      );
      return { file, code, names };
    })
    .filter(({ names }) => names.length > 0)
    .toSorted((a, b) => a.file.localeCompare(b.file));

  it.each(brandFiles.map(({ file, code, names }) => [file, code, names] as const))(
    "%s が描く印には brand-mark が付いている",
    (_file, code, names) => {
      expect(names.length).toBeGreaterThan(0);

      /*
       * 名前をそのまま書いて描いている場所は、1 つずつ確かめられる。
       */
      for (const name of names) {
        for (const [, attrs] of code.matchAll(new RegExp(`<${name}\\b([^>]*)>`, "g"))) {
          expect(`${name}: ${attrs}`).toContain("brand-mark");
        }
      }

      /*
       * ⚠️ **表から引いて `<Icon />` で描くファイルは、上の検査では追えない**
       * (social-links.tsx と share-menu.tsx がそれ)。せめて、印を扱うファイルが
       * `brand-mark` に一度も触れていない状態は落とす。
       */
      expect(code).toContain("brand-mark");
    },
  );

  it("印を置いているファイルの顔ぶれが変わっていない", () => {
    expect(brandFiles.map(({ file }) => file)).toEqual([
      "./components/article-header/article-header.tsx",
      "./components/share/share-menu.tsx",
      "./components/social/social-links.tsx",
      "./routes/licenses.tsx",
    ]);
  });
});
