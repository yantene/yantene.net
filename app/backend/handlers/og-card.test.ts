import { describe, expect, it } from "vitest";
import { cardHtml, defaultCardHtml } from "./og-card";
import cityscapeSource from "~/frontend/assets/cityscape.svg?raw";
import characterSource from "~/frontend/assets/yantene-character.svg?raw";
import logotypeSource from "~/frontend/assets/yantene-logotype.svg?raw";
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
 * やんてねくんと「やんてね」の字形も、街と同じく素材の書き方に頼って data URI にしている。
 *
 * ヘッダーのロゴ (`~/lib/logo-layout`) とは寸法を共有しない (#545)。カードはやんてねくんを
 * どアップで左端に見切れさせ、字形は署名として単独で置く。
 */
describe("やんてねくんと字形の素材 (OG カードが頼っている書き方)", () => {
  it.each([
    ["character", characterSource],
    ["logotype", logotypeSource],
  ])("%s は塗りの色を currentColor で受けている", (_label, source) => {
    // img の data URI には文書の color が届かないので、焼き込む先の目印になる。
    expect(source).toContain('fill="currentColor"');
  });

  it.each([
    ["character", characterSource],
    ["logotype", logotypeSource],
  ])("%s の根元の viewBox が `0 0 w h` の形で読める", (_label, source) => {
    // og-card.ts は最初の viewBox を窓に差し替え、字形の幅を viewBox の比から導く。
    // 読めなければ窓が効かず、やんてねくんが全身で縮んで出る。
    expect(source).toMatch(/<svg [^>]*viewBox="0 0 [\d.]+ [\d.]+"/u);
  });
});

/** 素材に本文の色が焼き込まれているときに現れる字面。 */
const INKED_ARTWORK = encodeURIComponent('fill="#1a2740"');
const UNINKED_ARTWORK = encodeURIComponent("currentColor");

/** HTML に置かれた data URI の SVG を、元の字面に戻して取り出す。 */
const embeddedSvgs = (html: string): readonly string[] =>
  [...html.matchAll(/src="data:image\/svg\+xml,([^"]+)"/gu)].map(([, uri = ""]) =>
    decodeURIComponent(uri),
  );

/*
 * 意匠を単体で組めるようになったので、ここで確かめる。分ける前は Hono のルータと
 * workers-og を通さないと 1 文字も見られなかった。
 */
describe("cardHtml", () => {
  const params = {
    title: "はじめての記事",
    date: "2026-05-08",
  };

  it("表題と日付を載せる", () => {
    const html = cardHtml(params);

    expect(html).toContain("はじめての記事");
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
   * **絵文字の位置は切り口に合わせてある。** 切るのは 44 個目 (TITLE_MAX - 1) なので、
   * 43 文字の後ろに置くと、UTF-16 で切ったときにちょうど上位サロゲートだけが残る。
   * ここを外すと、素の slice に戻してもテストが通ってしまう。**TITLE_MAX を変えたら
   * ここも合わせること。**
   */
  it("長い表題を書記素の単位で切り詰める", () => {
    const html = cardHtml({ ...params, title: `${"あ".repeat(43)}🎉のこり` });

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

  it("やんてねくんと署名の字形を置く (本文の色を焼き込んで)", () => {
    const html = cardHtml(params);

    expect(html).toContain(INKED_ARTWORK);
    expect(html).not.toContain(UNINKED_ARTWORK);
  });

  /*
   * やんてねくんはカード全体に重ねた img で、窓をカードと同じ比で切ってある。比が
   * 食い違うと、Satori と resvg が余白を付けて縮めるか切るかを勝手に選び、寄せた
   * つもりの絵がずれる。
   */
  it("やんてねくんの窓をカードと同じ縦横比で切る", () => {
    // 素材の中の最初の id で見分ける。書き出し直して id が振り直されても追いかけられる。
    const marker = /id="[^"]+"/u.exec(characterSource)?.[0] ?? "";
    const character = embeddedSvgs(cardHtml(params)).find((svg) => svg.includes(marker));
    const [, , width = Number.NaN, height = Number.NaN] = (
      /viewBox="([^"]+)"/u.exec(character ?? "")?.[1] ?? ""
    )
      .split(" ")
      .map(Number);

    expect(width / height).toBeCloseTo(1200 / 630, 3);
  });

  /*
   * workers-og はタグの間の空白を flex の子として数える。残すと `justify-content` が
   * 見えない子の分まで間を割り振り、表題が狙った高さからずれる。
   */
  it("タグの間に空白を残さない", () => {
    expect(cardHtml(params)).not.toMatch(/>\s+</u);
  });
});

describe("defaultCardHtml", () => {
  it("やんてねくんと名乗りの字形を置く (本文の色を焼き込んで)", () => {
    const html = defaultCardHtml();

    expect(html).toContain(INKED_ARTWORK);
    expect(html).not.toContain(UNINKED_ARTWORK);
  });

  it("タグの間に空白を残さない", () => {
    expect(defaultCardHtml()).not.toMatch(/>\s+</u);
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
