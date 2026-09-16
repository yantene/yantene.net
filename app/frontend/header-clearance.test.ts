import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/*
 * CSS は import ではなく実ファイルから読む (vitest は CSS の import を空にする。理由と
 * 前例は theme-tokens.test.ts / clock-origin.test.ts にある)。
 */
const FRONTEND = path.dirname(fileURLToPath(import.meta.url));

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const here = path.join(dir, entry.name);
    if (entry.isDirectory()) return cssFiles(here);
    return entry.name.endsWith(".css") ? [here] : [];
  });
}

/**
 * ヘッダーの帯をよける位置を、**サイト全体で 1 か所**に保つための見張り。
 *
 * sticky な札 (記事の年表の年、経歴の章) は帯の下で止まる。その位置を各ファイルに数で
 * 書き写すと、**帯の高さを変えたときに片方だけ直り、もう片方は帯に潜るか浮く**。
 * しかも何も落ちないので、誰かがその画面を見るまで気づけない。
 *
 * ⚠️ **値そのものを固定しているのではない。** 4.5rem を変えたければ app.css を直せば
 * よい。止めているのは「2 か所目に書き写すこと」。
 */
describe("ヘッダーをよける位置", () => {
  const files = cssFiles(FRONTEND).map((file) => ({
    name: path.relative(FRONTEND, file),
    css: readFileSync(file, "utf8"),
  }));

  it("app.css だけが値を持つ", () => {
    const defining = files.filter((file) => file.css.includes("--header-clearance:"));

    expect(defining.map((file) => file.name)).toEqual(["app.css"]);
  });

  it("sticky で止める位置を数で書き写さない", () => {
    const copied = files
      .filter((file) => file.name !== "app.css")
      .filter((file) => /top:\s*4\.5rem/u.test(file.css));

    expect(copied.map((file) => file.name)).toEqual([]);
  });

  /** 実際に使われていること (トークンを定義しただけで誰も読んでいない、を止める)。 */
  it("札を止めている場所はトークンを読む", () => {
    const users = files.filter((file) => file.css.includes("top: var(--header-clearance)"));

    expect(users.map((file) => file.name).toSorted()).toEqual([
      "components/article-timeline/article-timeline.css",
      "components/profile/profile-history.css",
    ]);
  });
});
