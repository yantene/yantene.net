import { describe, expect, it } from "vitest";
import { LOGO_CHARACTER, LOGO_LOGOTYPE, LOGO_VIEW_BOX } from "./logo-layout";
import characterSource from "~/frontend/assets/yantene-character.svg?raw";
import logotypeSource from "~/frontend/assets/yantene-logotype.svg?raw";

/*
 * ロゴは合成済みの 1 枚では持たず、素材 2 つをこの寸法で並べる (#527)。寸法は素材の
 * viewBox から導いた値なので、素材の viewBox が動くと並びがずれる。**ずれても絵は
 * 出てしまう** (縦横比が崩れれば余白ができ、窓が素材をはみ出せば何も描かれない帯が
 * できるだけ) ので、数で突き合わせる。
 */
describe("ロゴの寸法 (素材の viewBox との突き合わせ)", () => {
  const parseViewBox = (value: string): readonly number[] => value.split(" ").map(Number);
  const viewBoxOf = (source: string): readonly number[] =>
    parseViewBox(/viewBox="([^"]+)"/u.exec(source)?.[1] ?? "");

  it.each([
    ["character", parseViewBox(LOGO_CHARACTER.viewBox), LOGO_CHARACTER],
    ["logotype", viewBoxOf(logotypeSource), LOGO_LOGOTYPE],
  ])("%s を置く大きさが、出す窓と同じ縦横比になっている", (_label, window, box) => {
    const [, , width = Number.NaN, height = Number.NaN] = window;

    expect(box.width / box.height).toBeCloseTo(width / height, 3);
  });

  /* 胸から上の窓は、素材の上端から開けて、素材の幅いっぱいで中に収まっている。 */
  it("キャラクターの窓が素材の中に収まっている", () => {
    const [, , sourceWidth = Number.NaN, sourceHeight = Number.NaN] = viewBoxOf(characterSource);
    const [x, y, width = Number.NaN, height = Number.NaN] = parseViewBox(LOGO_CHARACTER.viewBox);

    expect([x, y]).toEqual([0, 0]);
    expect(width).toBeCloseTo(sourceWidth, 3);
    expect(height).toBeLessThanOrEqual(sourceHeight);
  });

  it("キャラクターの窓がロゴの高さいっぱいに着く", () => {
    expect(LOGO_CHARACTER.y).toBe(0);
    expect(LOGO_CHARACTER.height).toBeCloseTo(LOGO_VIEW_BOX.height, 3);
  });

  /* 並べ終えた幅は、字形の右端がちょうど viewBox の右端に着くことで決まっている。 */
  it("並べた姿の幅が素材から導ける", () => {
    expect(LOGO_LOGOTYPE.x + LOGO_LOGOTYPE.width).toBeCloseTo(LOGO_VIEW_BOX.width, 3);
  });
});
