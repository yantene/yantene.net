import { describe, expect, it } from "vitest";
import resources from "./index";

/**
 * **画面に見える名前は訳さない。**
 *
 * 場所と区画の名前 — ナビの行き先、見出し、常設の導線の字 — は日本語モードでも英語のまま
 * 出す。作り手の周りのサイトがそうなっているのと、名前を訳すと同じ場所が言語によって
 * 別の名前で呼ばれることになるため (URL は `/articles` のままなのに見出しだけ「記事」に
 * なる、など)。
 *
 * **訳すのは読み手に語りかける文のほう。** 案内・結果・エラーは日本語で書く。
 *
 * **読み上げにしか出ない名前も訳す。** ランドマークの名前 (`navigation.siteNavLabel` や
 * `footer.navLabel`) は画面に出ないので、英語で揃える理由が無い。見える字と食い違う
 * 心配も無い (見える相方がいない)。
 *
 * ここはその線引きを固定する場所。翻訳リソースは「日本語が空いている = 訳し忘れ」に
 * 見えるので、放っておくと親切心で訳し戻される。
 */
const untranslatedNames = [
  "home.popular",
  "home.latest",
  "navigation.about",
  "navigation.articles",
  "navigation.notes",
  "navigation.slides",
  "feed.label",
  // フィードの選び場所に並ぶ「全部」。隣に並ぶ Articles / Notes / Slides が英語のままなので、
  // ここだけ「すべて」にすると 1 つの板の中で語が混ざる。
  "feed.all",
  "articles.title",
  "articles.heading",
  "articles.related",
  "articles.toc",
  "search.title",
  "share.title",
  "webmention.heading",
  "footer.licenses",
  "licenses.title",
  "licenses.licenseLabel",
  "comingSoon.badge",
] as const;

type Translations = Record<string, unknown>;

function valueAt(translations: Translations, dotted: string): unknown {
  return dotted.split(".").reduce<unknown>((node, key) => {
    if (typeof node !== "object" || node === null) return undefined;
    return (node as Translations)[key];
  }, translations);
}

/** 葉のキーを `a.b.c` の形で全部集める。 */
function leafKeys(translations: Translations, prefix = ""): string[] {
  return Object.entries(translations).flatMap(([key, value]) => {
    const path = `${prefix}${key}`;
    if (typeof value === "object" && value !== null) {
      return leafKeys(value as Translations, `${path}.`);
    }
    return [path];
  });
}

const en = resources.en.translation as Translations;
const ja = resources.ja.translation as Translations;

describe("翻訳リソース", () => {
  /*
   * 片方にしか無いキーは、そのロケールでキーの文字列がそのまま画面に出る
   * (i18next は見つからないキーをキー名で描く)。静かに壊れるので形で止める。
   */
  it("en と ja は同じキーを持つ", () => {
    expect(leafKeys(ja).toSorted()).toEqual(leafKeys(en).toSorted());
  });

  it.each(untranslatedNames)("%s は日本語モードでも英語のまま", (key) => {
    const value = valueAt(en, key);

    expect(typeof value).toBe("string");
    expect(valueAt(ja, key)).toBe(value);
  });

  /*
   * 線引きが片側だけになっていないことも見る。名前を英語で揃えたからといって、
   * 読み手に語りかける文まで英語にはしない。
   */
  it("案内や結果の文は日本語のまま", () => {
    for (const key of ["articles.empty", "search.hint", "search.empty", "comingSoon.about"]) {
      expect(valueAt(ja, key)).not.toBe(valueAt(en, key));
    }
  });

  it("読み上げにしか出ないランドマークの名前は日本語のまま", () => {
    for (const key of ["navigation.siteNavLabel", "navigation.menuLabel", "footer.navLabel"]) {
      expect(valueAt(ja, key)).not.toBe(valueAt(en, key));
    }
  });
});
