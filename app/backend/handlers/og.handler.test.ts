import { describe, expect, it } from "vitest";
import cityscapeSource from "~/frontend/assets/cityscape.svg?raw";

/**
 * OG カードは街並みの素材をそのままは使えない。輪郭が `currentColor` で、線の太さを
 * 持たず、雲が混じっているためで、`og.handler.ts` はこれらを素材の書き方に頼って解いて
 * いる。頼っている書き方が変わっていないことをここで見張る。
 *
 * 素材は scripts/extract-illustration.py が作業用の illustration.svg から書き出し、
 * 書き出したものを手で整えて置いてある (整え方は素材の先頭に書いてある)。だからここが
 * 落ちたときに直す先は、素材そのものでも `og.handler.ts` でもなく、たいていは書き出しと
 * 手入れの工程。たとえば `clean()` が吐くのは `style="…stroke:currentColor…"` で、
 * ここが見ている `stroke="currentColor"` の形は手入れを経て初めて現れる。
 */
describe("cityscape.svg (OG カードが頼っている書き方)", () => {
  it("雲と街を id で分けている", () => {
    // 雲は流れることで雲に見える意匠なので、止まった絵の OG では落とす。
    expect(cityscapeSource).toContain('<g id="clouds">');
    expect(cityscapeSource).toContain('<g id="skyline">');
  });

  it("雲を先に、街を後に置いている", () => {
    // og.handler.ts は「雲の頭から街の頭まで」を切って雲を落とす。
    expect(cityscapeSource.indexOf('<g id="clouds">')).toBeLessThan(
      cityscapeSource.indexOf('<g id="skyline">'),
    );
  });

  it("輪郭の色を currentColor で受けている", () => {
    // img の data URI には文書の color が届かないので、焼き込む先の目印になる。
    expect(cityscapeSource).toContain('stroke="currentColor"');
  });

  it("線の太さを持たない", () => {
    // 太さは画面では CSS が、OG では og.handler.ts が与える。素材が持ち始めたら
    // 与えた値が効かなくなる (要素側の指定が勝つ)。
    expect(cityscapeSource).not.toContain("stroke-width");
  });

  it("根元のタグが属性を伴って開いている", () => {
    // og.handler.ts は `"<svg "` を目印に線の太さを差し込む。文字列指定の replace は
    // 見つからなければ黙って何もしないので、`<svg>` や `<svg\n` に変わると線が
    // 既定の太さ (この縮尺で約 3px) のまま出る。
    expect(cityscapeSource).toContain("<svg ");
  });

  it("viewBox の縦横比が変わっていない", () => {
    // og.handler.ts の CITYSCAPE_HEIGHT (1200px 幅に対する 175px) はこの比から出した
    // 値で、img には preserveAspectRatio を渡していない。比が動くと街が縦に潰れる。
    expect(cityscapeSource).toContain('viewBox="0 0 407.1932 59.2666"');
  });
});
