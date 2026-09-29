import { describe, expect, it } from "vitest";
import { cardElement, defaultCardElement } from "./og-card";
import cityscapeSource from "~/frontend/assets/cityscape.svg?raw";
import characterSource from "~/frontend/assets/yantene-character.svg?raw";
import logotypeSource from "~/frontend/assets/yantene-logotype.svg?raw";
import ja from "~/lib/i18n/locales/ja.json";

/**
 * OG カードは街並みの素材をそのままは使えない。輪郭が `currentColor` で、線の太さを
 * 持たず、雲が混じっているためで、`og-card.tsx` はこれらを素材の書き方に頼って解いて
 * いる。頼っている書き方が変わっていないことをここで見張る。
 *
 * 素材は scripts/extract-illustration.py が作業用の illustration.svg から書き出し、
 * 書き出したものを手で整えて置いてある (整え方は素材の先頭に書いてある)。だからここが
 * 落ちたときに直す先は、素材そのものでも `og-card.tsx` でもなく、たいていは書き出しと
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
    // og-card.tsx は「雲の頭から街の頭まで」を切って雲を落とす。
    expect(cityscapeSource.indexOf('<g id="clouds">')).toBeLessThan(
      cityscapeSource.indexOf('<g id="skyline">'),
    );
  });

  it("輪郭の色を currentColor で受けている", () => {
    // img の data URI には文書の color が届かないので、焼き込む先の目印になる。
    expect(cityscapeSource).toContain('stroke="currentColor"');
  });

  it("線の太さを持たない", () => {
    // 太さは画面では CSS が、OG では og-card.tsx が与える。素材が持ち始めたら
    // 与えた値が効かなくなる (要素側の指定が勝つ)。
    expect(cityscapeSource).not.toContain("stroke-width");
  });

  it("根元のタグが属性を伴って開いている", () => {
    // og-card.tsx は `"<svg "` を目印に線の太さを差し込む。文字列指定の replace は
    // 見つからなければ黙って何もしないので、`<svg>` や `<svg\n` に変わると線が
    // 既定の太さ (この縮尺で約 3px) のまま出る。
    expect(cityscapeSource).toContain("<svg ");
  });

  it("viewBox の縦横比が変わっていない", () => {
    // og-card.tsx の CITYSCAPE_HEIGHT (1200px 幅に対する 175px) はこの比から出した
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
    // og-card.tsx は最初の viewBox を窓に差し替え、字形の幅を viewBox の比から導く。
    // 読めなければ窓が効かず、やんてねくんが全身で縮んで出る。
    expect(source).toMatch(/<svg [^>]*viewBox="0 0 [\d.]+ [\d.]+"/u);
  });
});

/** 素材に本文の色が焼き込まれているときに現れる字面。 */
const INKED_ARTWORK = encodeURIComponent('fill="#1a2740"');
const UNINKED_ARTWORK = encodeURIComponent("currentColor");

/*
 * カードは Satori に要素の木で渡す。関数のコンポーネントを呼び開いて、Satori が
 * 受け取るのと同じ素の木にしてから確かめる。
 */
type Tree = string | number | boolean | null | undefined | Element | readonly Tree[];
type Element = { type: unknown; props: { children?: Tree } & Record<string, unknown> };

const isElement = (node: unknown): node is Element =>
  typeof node === "object" && node !== null && "type" in node && "props" in node;

function expand(node: Tree): Tree {
  if (Array.isArray(node)) return node.map((child: Tree) => expand(child));
  if (!isElement(node)) return node;
  if (typeof node.type === "function") {
    return expand((node.type as (props: unknown) => Tree)(node.props));
  }
  return { ...node, props: { ...node.props, children: expand(node.props.children) } };
}

/** 木の中の要素をすべて並べる。 */
function elementsOf(node: Tree): readonly Element[] {
  if (Array.isArray(node)) return node.flatMap((child: Tree) => elementsOf(child));
  if (!isElement(node)) return [];
  return [node, ...elementsOf(node.props.children)];
}

/** 子として文字列 `text` だけを持つ要素 (Satori から見て 1 つの文字の塊) を探す。 */
const holderOf = (tree: Tree, text: string): Element | undefined =>
  elementsOf(tree).find((element) => element.props.children === text);

/** 木に置かれた data URI の SVG を、元の字面に戻して取り出す。 */
const embeddedSvgs = (tree: Tree): readonly string[] =>
  elementsOf(tree)
    .map((element) => element.props["src"])
    .filter((src): src is string => typeof src === "string")
    .filter((src) => src.startsWith("data:image/svg+xml,"))
    .map((src) => decodeURIComponent(src.slice("data:image/svg+xml,".length)));

/** 木の全体を 1 つの字面にする (焼き込みや文言の有無を見るため)。 */
const flatten = (tree: Tree): string => JSON.stringify(tree);

/*
 * 意匠を単体で組めるようになったので、ここで確かめる。分ける前は Hono のルータと
 * workers-og を通さないと 1 文字も見られなかった。
 */
describe("cardElement", () => {
  const params = {
    title: "はじめての記事",
    date: "2026-05-08",
  };
  const card = (overrides: Partial<typeof params> = {}): Tree =>
    expand(cardElement({ ...params, ...overrides }));

  it("表題と日付を載せる", () => {
    const tree = card();

    expect(holderOf(tree, "はじめての記事")).toBeDefined();
    expect(holderOf(tree, "2026-05-08")).toBeDefined();
  });

  /*
   * **表題は 1 つの文字列の子として渡す。** HTML の文字列で渡していたときは、workers-og が
   * HTMLRewriter から流れてきた文字の塊をそのまま子に並べ、表題が途中で割れていた。
   * 割れると `lineClamp` が効かず (子が 2 つ以上なら flex しか許されない)、flex では
   * 割れ目で段組みのように崩れる。
   */
  it("表題を 1 つの文字の塊として、実際の幅で 3 行に畳む", () => {
    const title = holderOf(card(), "はじめての記事");

    expect(title?.props["style"]).toMatchObject({
      display: "block",
      lineClamp: 3,
      wordBreak: "break-word",
    });
  });

  /*
   * 要素の木で渡すので、表題は HTML として読まれない。実体参照にすると `&lt;` が
   * そのまま字として出る。
   */
  it("表題の記号をそのままの字として渡す", () => {
    const raw = `<script>と"引用"と&`;

    expect(holderOf(card({ title: raw }), raw)).toBeDefined();
  });

  /*
   * 切り詰めは書記素で数える。UTF-16 の単位で切ると絵文字や拡張漢字が半分に割れ、
   * 豆腐になる。
   *
   * **絵文字の位置は切り口に合わせてある。** 切るのは 119 個目 (TITLE_MAX - 1) なので、
   * 118 文字の後ろに置くと、UTF-16 で切ったときにちょうど上位サロゲートだけが残る。
   * ここを外すと、素の slice に戻してもテストが通ってしまう。**TITLE_MAX を変えたら
   * ここも合わせること。**
   */
  it("途方もなく長い表題を書記素の単位で切り詰める", () => {
    const text = flatten(card({ title: `${"あ".repeat(118)}🎉のこり` }));

    expect(text).toContain("…");
    expect(text).not.toContain("のこり");
    // 片割れになった上位サロゲートが残っていないこと (JSON では \\ud83c のように出る)。
    expect(text).not.toMatch(/\\ud[89ab][0-9a-f]{2}(?!\\ud[c-f])/iu);
  });

  it("3 行に収まらない程度の表題は字数で切らない (畳むのは lineClamp)", () => {
    const title = "あ".repeat(60);

    expect(holderOf(card({ title }), title)).toBeDefined();
  });

  it("街と上端の帯を敷く", () => {
    const text = flatten(card());

    expect(text).toContain("data:image/svg+xml,");
    expect(text).toContain("linear-gradient(90deg");
  });

  it("やんてねくんと署名の字形を置く (本文の色を焼き込んで)", () => {
    const text = flatten(card());

    expect(text).toContain(INKED_ARTWORK);
    expect(text).not.toContain(UNINKED_ARTWORK);
  });

  /*
   * やんてねくんはカード全体に重ねた img で、窓をカードと同じ比で切ってある。比が
   * 食い違うと、Satori と resvg が余白を付けて縮めるか切るかを勝手に選び、寄せた
   * つもりの絵がずれる。
   */
  it("やんてねくんの窓をカードと同じ縦横比で切る", () => {
    // 素材の中の最初の id で見分ける。書き出し直して id が振り直されても追いかけられる。
    const marker = /id="[^"]+"/u.exec(characterSource)?.[0] ?? "";
    const character = embeddedSvgs(card()).find((svg) => svg.includes(marker));
    const [, , width = Number.NaN, height = Number.NaN] = (
      /viewBox="([^"]+)"/u.exec(character ?? "")?.[1] ?? ""
    )
      .split(" ")
      .map(Number);

    expect(width / height).toBeCloseTo(1200 / 630, 3);
  });
});

describe("defaultCardElement", () => {
  const card = (): Tree => expand(defaultCardElement());

  it("やんてねくんと名乗りの字形を置く (本文の色を焼き込んで)", () => {
    const text = flatten(card());

    expect(text).toContain(INKED_ARTWORK);
    expect(text).not.toContain(UNINKED_ARTWORK);
  });

  /*
   * 添え書きは ja.json の home.tagline と同じ文言にしてある。ここに直に書いてあるので、
   * ja.json だけを書き換えると **OG カードだけが古い文言を出し続ける。**
   *
   * 配色を `= --token` の印で見張っているのと同じ理由。OG カードは日々の開発では
   * 目に入らないまま古びていく。
   */
  it("添え書きが ja.json の home.tagline と揃っている", () => {
    expect(holderOf(card(), ja.home.tagline)).toBeDefined();
  });
});
