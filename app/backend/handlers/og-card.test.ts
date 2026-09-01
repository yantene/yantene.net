import { describe, expect, it } from "vitest";
import { cardHtml, defaultCardHtml } from "./og-card";
import cityscapeSource from "~/frontend/assets/cityscape.svg?raw";
import ja from "~/lib/i18n/locales/ja.json";

/**
 * OG カードは街並みの素材をそのままは使えない。輪郭が `currentColor` で、線の太さを
 * 持たず、雲が混じっているためで、`og-card.ts` はこれらを素材の書き方に頼って解いて
 * いる。頼っている書き方が変わっていないことをここで見張る。
 *
 * 素材は scripts/extract-illustration.py が作業用の illustration.svg から書き出し、
 * 書き出したものを手で整えて置いてある (整え方は素材の先頭に書いてある)。だからここが
 * 落ちたときに直す先は、素材そのものでも `og-card.ts` でもなく、たいていは書き出しと
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
    // og-card.ts は「雲の頭から街の頭まで」を切って雲を落とす。
    expect(cityscapeSource.indexOf('<g id="clouds">')).toBeLessThan(
      cityscapeSource.indexOf('<g id="skyline">'),
    );
  });

  it("輪郭の色を currentColor で受けている", () => {
    // img の data URI には文書の color が届かないので、焼き込む先の目印になる。
    expect(cityscapeSource).toContain('stroke="currentColor"');
  });

  it("線の太さを持たない", () => {
    // 太さは画面では CSS が、OG では og-card.ts が与える。素材が持ち始めたら
    // 与えた値が効かなくなる (要素側の指定が勝つ)。
    expect(cityscapeSource).not.toContain("stroke-width");
  });

  it("根元のタグが属性を伴って開いている", () => {
    // og-card.ts は `"<svg "` を目印に線の太さを差し込む。文字列指定の replace は
    // 見つからなければ黙って何もしないので、`<svg>` や `<svg\n` に変わると線が
    // 既定の太さ (この縮尺で約 3px) のまま出る。
    expect(cityscapeSource).toContain("<svg ");
  });

  it("viewBox の縦横比が変わっていない", () => {
    // og-card.ts の CITYSCAPE_HEIGHT (1200px 幅に対する 175px) はこの比から出した
    // 値で、img には preserveAspectRatio を渡していない。比が動くと街が縦に潰れる。
    expect(cityscapeSource).toContain('viewBox="0 0 407.1932 59.2666"');
  });
});

/*
 * 意匠を単体で組めるようになったので、ここで確かめる。分ける前は Hono のルータと
 * workers-og を通さないと 1 文字も見られなかった。
 */
describe("cardHtml", () => {
  const params = {
    title: "はじめてのノート",
    date: "2026-05-08",
  };

  it("表題と日付を載せる", () => {
    const html = cardHtml(params);

    expect(html).toContain("はじめてのノート");
    expect(html).toContain("2026-05-08");
  });

  /*
   * Satori に渡すのは HTML の文字列なので、表題の `<` をそのまま流すと本文が
   * タグとして解釈される。
   */
  it("表題の記号を実体参照にする", () => {
    const html = cardHtml({ ...params, title: `<script>と"引用"と&` });

    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&quot;引用&quot;");
    expect(html).toContain("&amp;");
    expect(html).not.toContain("<script>");
  });

  /*
   * 切り詰めは書記素で数える。UTF-16 の単位で切ると絵文字や拡張漢字が半分に割れ、
   * 豆腐になる。
   *
   * **絵文字の位置は切り口に合わせてある。** 切るのは 55 個目 (TITLE_MAX - 1) なので、
   * 54 文字の後ろに置くと、UTF-16 で切ったときにちょうど上位サロゲートだけが残る。
   * ここを外すと、素の slice に戻してもテストが通ってしまう。
   */
  it("長い表題を書記素の単位で切り詰める", () => {
    const html = cardHtml({ ...params, title: `${"あ".repeat(54)}🎉のこり` });

    expect(html).toContain("…");
    // 片割れになった上位サロゲートが残っていないこと。
    expect(html).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });

  it("短い表題は切り詰めない", () => {
    expect(cardHtml(params)).not.toContain("…");
  });

  it("街と上端の帯を敷く", () => {
    const html = cardHtml(params);

    expect(html).toContain("data:image/svg+xml,");
    expect(html).toContain("linear-gradient(90deg");
  });
});

describe("defaultCardHtml", () => {
  it("名乗りを中央に置く", () => {
    expect(defaultCardHtml()).toContain("やんてね");
  });

  /*
   * 添え書きは ja.json の home.tagline と同じ文言にしてある。ここに直に書いてあるので、
   * ja.json だけを書き換えると **OG カードだけが古い文言を出し続ける。**
   *
   * 配色を `= --token` の印で見張っているのと同じ理由。OG カードは日々の開発では
   * 目に入らないまま古びていく。
   */
  it("添え書きが ja.json の home.tagline と揃っている", () => {
    expect(defaultCardHtml()).toContain(ja.home.tagline);
  });
});
