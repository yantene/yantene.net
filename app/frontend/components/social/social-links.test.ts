import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { socialPlatforms } from "~/lib/social-platforms";

/*
 * CSS は import ではなく実ファイルから読む (vitest は CSS の import を空にする。理由と
 * 前例は theme-tokens.test.ts / clock-origin.test.ts にある)。相対パスの解決に `new URL` を
 * 使わないのは、happy-dom の URL が file: の基底を無視して http://localhost へ寄せるため。
 */
const css = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "social-links.css"),
  "utf8",
);

/**
 * 出ていく先の絵が、ブランド規定どおりに出る状態を保つための見張り。
 *
 * ここで固定しているのは好みではなく、各社が書いている規定である。
 *
 * **絵の色そのものは `brand-marks.test.ts` が見張る** (置き場所によらない話なので、
 * あちらに寄せてある)。ここが見るのは台と寸法。出典も brand-marks.css に集めてある。
 */
describe("social-links.css", () => {
  /*
   * 台。抜き (GitHub の猫・Mastodon の m・Discord の目) から後ろが透けないように、
   * 不透明な白を敷く。半透明にすると、ヒーローの動く空が抜きに入って猫の色が時刻で
   * 変わる状態に戻る。
   */
  it("台は不透明な白で敷く", () => {
    expect(css).toMatch(/\.social-link\s*\{[^}]*background:\s*var\(--color-base-100\)/);
  });

  /*
   * hover で染めるのは台であって絵ではない。絵を染めるのが上記の recolor 禁止に当たる。
   */
  it("hover で絵の色を変えない", () => {
    const hoverBlock = css.match(/\.social-link:hover\s*\{[^}]*\}/)?.[0] ?? "";
    expect(hoverBlock).toContain("background:");
    expect(hoverBlock).not.toMatch(/(^|[^-])color:/);
  });

  /*
   * 光学補正の取りこぼしを止める。
   *
   * platform を足したときにここへ書き忘れると、その絵だけ補正なしで出る。壊れはしないが
   * 並びが揃わず、見ても理由が分からない状態になる。補正が要らないなら 1 と書くこと。
   */
  it.each(socialPlatforms)("%s に光学補正の段階がある", (platform) => {
    expect(css).toMatch(
      new RegExp(`\\.social-link-${platform}\\s*\\{[^}]*--social-icon-scale:\\s*[\\d.]+`),
    );
  });

  /*
   * 安全余白の量。**「台に収まっている」では足りない。**
   *
   * いちばん大きい絵でも、台の縁までが絵の半分以上空いていること。1em に戻すと真円の
   * GitHub は縁までの白が絵の 1/4 しか残らず、台に乗っているというより、はみ出しかけて
   * いるように見える。「収まってさえいればよい」と書くと 1em でも通ってしまい、
   * 余白のための検査が余白を守らなくなる。
   */
  it("いちばん大きい絵でも、台の縁まで絵の半分以上空く", () => {
    const plate = Number(css.match(/\.social-link\s*\{[^}]*width:\s*([\d.]+)em/)?.[1]);
    const glyph = Number(css.match(/\.social-link > svg\s*\{[^}]*width:\s*calc\(([\d.]+)em/)?.[1]);
    const largestScale = Math.max(
      ...[...css.matchAll(/--social-icon-scale:\s*([\d.]+)/g)].map((m) => Number(m[1])),
    );

    expect(plate).toBeGreaterThan(0);
    expect(glyph).toBeGreaterThan(0);

    const largestGlyph = glyph * largestScale;
    /*
     * 片側の余白 = (台 - 絵) / 2。これが絵の 1/2 以上 ⇔ 台が絵の 2 倍以上。
     *
     * いまの値は 台 2em / いちばん大きい絵 0.86 × 1.06 = 0.912em で、片側 0.54em
     * (絵の 0.60 倍)。絵を 1em に戻すと 0.47em (絵の 0.44 倍) になり、ここで落ちる。
     */
    expect(largestGlyph * 2).toBeLessThanOrEqual(plate);
  });

  /*
   * 押している間、台が透けないこと。
   *
   * press-control は :active で opacity: 0.6 を掛ける。台ごと薄くなると抜きから後ろが
   * 透け、直したはずのものが押している間だけ戻る。打ち消しは置いてあるが、
   * `.social-link:active` だけでは `.press-control:active` と詳細度が並び
   * (どちらも 0,2,0)、interaction.css のほうが app.css で後に import されているので
   * **あちらが勝って黙って効かなくなる**。要素で 1 つ上げてあることを固定する。
   */
  it("押している間の打ち消しが press-control に勝つ詳細度を持つ", () => {
    expect(css).toMatch(/a\.social-link:active\s*\{[^}]*opacity:\s*1\b/);
  });
});
