// インライン SVG / CSS の高エントロピー文字列を秘匿情報と誤検知するため無効化 (このファイルは秘密を含まない)。
/**
 * OG カードの意匠。
 *
 * Satori に渡す静的な要素を組み立てるだけで、配信も蓄えも知らない。相手は
 * og.handler.ts で、あちらは組み上がった要素を PNG にして R2 に置く。
 *
 * 分けてあるのは、この 2 つが変わる理由が違うため。ここが動くのは見た目を変えたいとき、
 * あちらが動くのは経路や蓄え方を変えたいとき。no-secrets を切っているのもこちらの都合
 * (インライン SVG と CSS が高エントロピーの文字列に見える) で、ルータ側は見張られたままになる。
 */
import characterSource from "~/frontend/assets/yantene-character.svg?raw";
import cityscapeSource from "~/frontend/assets/cityscape.svg?raw";
import logotypeSource from "~/frontend/assets/yantene-logotype.svg?raw";
import { truncateByGrapheme } from "~/lib/truncate";

/*
 * 表題の上限。
 *
 * 見た目の上では効いていない。カードに収まるかは `lineClamp` が実際の幅で決める
 * (`cardElement` を参照)。ここで切るのは、途方もなく長い表題を Satori に組ませて
 * Worker の CPU を使い切らないため。3 行ぶん (全角で 45 字ほど、英字だとその倍) を
 * 十分に超える長さにしてある。
 */
const TITLE_MAX = 120;
/**
 * カードのデザイン版。テンプレート/フォントを変えたら上げると全 OG が再生成される。
 *
 * ⚠️ **素材の絵を差し替えたときも上げること。** 蓄えのキーはこの版だけで決まるので、
 * 上げないと R2 の古い PNG が返り続ける (v14 はやんてねくんがノートパソコンを抱える
 * 姿になった回。preview で旧い絵が返ってきて気づいた)。
 */
export const OG_TEMPLATE_VERSION = "v17";

/*
 * カードの配色。app.css の daisyUI テーマ (name: "yantene") と、地平線を引いている
 * header.css から取ってある。あちらは色を実行時の custom property と color-mix で
 * 組み立てるが、ここは Satori に渡す静的な要素なのでどちらも使えない。白地に
 * 重ねた結果の色を数値で置く。
 *
 * テーマの値をそのまま写したものには `= --token` を添えてある。theme-tokens.test.ts が
 * この印を頼りに定義と突き合わせるので、テーマ側だけを変えるとテストが落ちる。
 * 白地に乗せた合成値には印を付けない (突き合わせる相手が無い)。
 */
/** 地平線と街の輪郭。 */
const HORIZON_INK = "#9488d3"; /* = --horizon-ink */
/** 上端の帯に流すテーマの色。 */
const PRIMARY = "#2b4a76"; /* = --color-primary */
const SECONDARY = "#78a2d2"; /* = --color-secondary */
const ACCENT = "#c9ab80"; /* = --color-accent */
/** 本文の色。 */
const INK = "#1a2740"; /* = --color-base-content */
/** 日付の色 (base-content を 62% で白地に乗せた色。--color-muted-foreground と同じ)。 */
const MUTED_INK = "#717989";

/**
 * `#rrggbb` に透明度を与える。
 *
 * 同じ色を 16 進と `rgba()` の 2 通りで書かないため。書き分けると、theme-tokens.test.ts が
 * 見張れるのは 16 進の側だけになり、テーマを変えたときに片方だけが直る。
 */
function withAlpha(hex: string, alpha: number): string {
  /*
   * `#rgb` のような短い書き方は受けない。黙って通すと `#94d` が (0, 9, 77) になり、
   * **それらしい色として出てしまう**。theme-tokens.test.ts は 3〜8 桁を認めるので、
   * テーマ側を短くした写しがここへ来る道はある (fail-loud)。
   */
  if (!/^#[0-9a-f]{6}$/i.test(hex)) {
    throw new RangeError(`withAlpha expects #rrggbb: ${hex}`);
  }
  const value = Number.parseInt(hex.slice(1), 16);
  const channels = [(value >> 16) & 255, (value >> 8) & 255, value & 255];
  return `rgba(${channels.map(String).join(",")},${alpha.toString()})`;
}

/*
 * 素材の先頭に付いている注記を落とす。data URI に入れても誰も読まないうえ、
 * `currentColor` の語を含むので下の色の焼き込みに巻き込まれる。
 */
function withoutPreamble(source: string): string {
  const opening = source.indexOf("<svg");
  return opening === -1 ? source : source.slice(opening);
}

/*
 * 街の素材から、カードに要るところだけを取り出す。
 *
 * 注記に加えて雲を落とす。雲は流れる
 * ことで雲に見える意匠 (hero-section.css がひと巡り 4 日かけて動かしている) なので、
 * 止まった絵では建物と同じ細さの線が空の途中に散らばっているようにしか見えない。
 *
 * 素材が再エクスポートされて印 (`id="clouds"` / `id="skyline"`) が変わったら、雲が
 * 落ちずに戻ってくる。絵が少し騒がしくなるだけなので、ここでは throw せずそのまま通す。
 */
function skylineOnly(source: string): string {
  const body = withoutPreamble(source);
  const clouds = body.indexOf('<g id="clouds">');
  const skyline = body.indexOf('<g id="skyline">');
  if (clouds === -1 || skyline === -1 || skyline < clouds) return body;
  return body.slice(0, clouds) + body.slice(skyline);
}

/*
 * ヒーローの足元と同じ街並み。
 *
 * 素材は輪郭を `currentColor` で受け、線の太さを持たない (画面では CSS が
 * `vector-effect: non-scaling-stroke` と合わせて決めている)。`img` の data URI として
 * 渡す SVG にはどちらも届かず、そのままだと輪郭が黒く、線も拡大率のぶんだけ太くなる。
 * ここで色を焼き込み、線の太さを user unit で与える。
 *
 * 0.4 は画面上の太さから逆算した値。カード幅 1200px を素材の viewBox 幅 407.1932 で
 * 割った拡大率がおよそ 2.95 倍なので、これで 1.2px ほどになる。ちょうど 1px にすると
 * OG がタイムラインで縮んだときに線が消える。
 *
 * 太さを `stroke-width` 属性ではなく `style` で与えるのは Satori のため。あちらは
 * `img` の SVG から素の寸法を読むのに `width=['"]…['"]` を根元のタグ全体へ当てるので、
 * `stroke-width="0.4"` を置くと、その一部を画像の幅 0.4px と読む。
 */
function cityscapeSvg(): string {
  return (
    skylineOnly(cityscapeSource)
      // 置換の文字列に `$&` のような指示を読ませないため、関数で色を返す。
      .replaceAll("currentColor", () => HORIZON_INK)
      .replace("<svg ", `<svg style="stroke-width:0.4" `)
  );
}

/**
 * カード幅 1200px に敷いたときの街の高さ。
 *
 * 素材の viewBox (407.1932 x 59.2666) の比から出した値で、`preserveAspectRatio` を
 * 指定しない `img` に渡す。素材を切り出す枠は scripts/extract-illustration.py の
 * `BOXES["cityscape"]` が決めており、そこを変えると比が動いて絵が縦に潰れる。
 * og-card.test.ts が viewBox を見張っているので、変えたらここも合わせること。
 */
const CITYSCAPE_HEIGHT = 175;

/** カードの寸法。 */
const CARD_WIDTH = 1200;
const CARD_HEIGHT = 630;

/**
 * 表題と日付を置き始める位置。左はやんてねくんに譲る。
 *
 * やんてねくんの窓を動かしたら、指さす手の先 (いまは約 359px) がここより手前に
 * 収まっているかを一緒に見ること。はみ出すと手が日付に掛かる。
 */
const CONTENT_LEFT = 340;

/**
 * やんてねくんの寄り方。素材の 1 unit をカードの何 px にするかと、カードの左上に来る
 * 素材の座標。
 *
 * **ロゴとは切り方を分けてある。** ヘッダーのロゴ (`~/lib/logo-layout`) は胸から上を
 * まるごと出すが、カードは顔と指さす手に寄せたどアップで、頭の天辺と後ろ頭は
 * カードの縁で切れる。寄せ方が違うので、寸法も共有しない。
 *
 * ⚠️ **顔のパーツ (両目・両頬・口) は切らない。** 左目は素材の x 70 あたりにあるので、
 * 窓の左端をこれより右へ寄せると目が欠け、誰の顔か読めなくなる。
 *
 * ⚠️ **見切れさせるのはカードの縁だけ。** 右と下は素材の輪郭のまま終わらせる。左に
 * 帯を立ててそこで切ると、靴や手が縦の直線で断たれて、絵が欠けて見える。
 *
 * ⚠️ **指さす手の先 (素材の x 171.6) が表題の少し手前に来るよう置いてある。** 手が
 * 表題を指すのがこの意匠の要なので、素材を差し替えて手の位置が動いたら見直すこと。
 */
const CHARACTER_SCALE = 3;
const CHARACTER_ORIGIN = { x: 52, y: 10 } as const;

/**
 * 素材から切り出す窓。カードと同じ縦横比にして、カード全体に重ねる。
 *
 * 窓と `img` の比が食い違うと、Satori と resvg は余白を付けて縮めるか、はみ出しを
 * 切るかのどちらかをする。比を揃えておけば、どちらでも同じ絵になる。
 */
const CHARACTER_WINDOW = {
  ...CHARACTER_ORIGIN,
  width: CARD_WIDTH / CHARACTER_SCALE,
  height: CARD_HEIGHT / CHARACTER_SCALE,
} as const;

/*
 * 絵はどれも `alt=""` にしてある。PNG に焼き込まれるので誰にも読まれないが、書かないと
 * lint (jsx-a11y) が止める。
 */

/*
 * 素材から組み立てた画。最初にカードを描くときまで遅らせる。
 *
 * このファイルは og.handler.ts 経由で index.ts から静的に繋がっているので、モジュールの
 * 評価はページ表示でもフィード取得でも走る。29 KB の置換と URI エンコードを、カードを
 * 描かない要求にまで負わせない (同じ理由で workers-og は動的 import にしてある)。
 *
 * 評価そのものを遅らせる余地はまだ残っている ([#301](https://github.com/yantene/yantene.net/issues/301))。
 */
const artwork: { cityscape?: string; character?: string; logotype?: string } = {};

/** 素材の根元の `<svg>` の viewBox を差し替え、その窓だけを出す。 */
function windowed(
  source: string,
  box: { x: number; y: number; width: number; height: number },
): string {
  const viewBox = [box.x, box.y, box.width, box.height].map(String).join(" ");
  // 置換の文字列に `$&` のような指示を読ませないため、関数で返す。
  return withoutPreamble(source).replace(/viewBox="[^"]*"/u, () => `viewBox="${viewBox}"`);
}

/**
 * 素材を `img` の data URI にする。
 *
 * 素材は塗りを `currentColor` で受ける。`img` の data URI には文書の color が届かない
 * ので、街と同じく本文の色を焼き込む。
 */
function inkedDataUri(svg: string): string {
  // 置換の文字列に `$&` のような指示を読ませないため、関数で色を返す。
  return `data:image/svg+xml,${encodeURIComponent(svg.replaceAll("currentColor", () => INK))}`;
}

/** 素材の viewBox (`0 0 w h`) の幅と高さ。 */
function viewBoxSize(source: string): { width: number; height: number } {
  const [, , width = Number.NaN, height = Number.NaN] = (
    /viewBox="([^"]+)"/u.exec(source)?.[1] ?? ""
  )
    .split(" ")
    .map(Number);
  return { width, height };
}

/**
 * カードの足元に敷く街。幅いっぱいに置き、下端 (素材では地平線) をカードの底に合わせる。
 *
 * 通常の流れから外して底に貼ってあるのは、中身の置き場を街のぶん削らないため。削ると
 * 真ん中に置いた表題が上へ押し上げられ、指さす手の高さから外れる。長い表題の裾は
 * 街に重なるが、線が薄いぶん字は読める (画面のヒーローも同じ扱いで、hero-section.css が
 * 「テキストを街の上に逃がすとヒーローが間延びする」と書いている)。
 *
 * やんてねくんは街より手前に立つ。素材の白い裏打ちが輪郭の内側の線を隠す。
 */
function Cityscape(): React.JSX.Element {
  artwork.cityscape ??= `data:image/svg+xml,${encodeURIComponent(cityscapeSvg())}`;
  return (
    <img
      alt=""
      src={artwork.cityscape}
      width={CARD_WIDTH}
      height={CITYSCAPE_HEIGHT}
      style={{ position: "absolute", left: 0, bottom: 0 }}
    />
  );
}

/** 左端に見切れるやんてねくん。カード全体に重ね、はみ出しはカードの縁で切れる。 */
function Character(): React.JSX.Element {
  artwork.character ??= inkedDataUri(windowed(characterSource, CHARACTER_WINDOW));
  return (
    <img
      alt=""
      src={artwork.character}
      width={CARD_WIDTH}
      height={CARD_HEIGHT}
      style={{ position: "absolute", left: 0, top: 0 }}
    />
  );
}

/**
 * 「やんてね」の字形を高さで置く。幅は素材の縦横比から導く。
 *
 * キャラクターと並べたロゴは使わない。やんてねくんはもう左端にいるので、並べると
 * 1 枚に 2 人立つことになる。
 */
function Logotype({ height }: { height: number }): React.JSX.Element {
  artwork.logotype ??= inkedDataUri(withoutPreamble(logotypeSource));
  const size = viewBoxSize(logotypeSource);
  const width = Math.round((height * size.width) / size.height);
  return (
    <img alt="" src={artwork.logotype} width={width} height={height} style={{ width, height }} />
  );
}

/*
 * カードの上端の帯。
 *
 * 白いカードがタイムラインの白地に溶けないよう、上端だけは色を持たせる。流す色は
 * テーマから取り、両端に accent (tan)、中ほどに primary (紺) を置いて、真ん中がいちばん
 * 濃くなるようにしてある。端を濃くすると、縮んだときに帯が片側へ寄って見える。
 *
 * 下に落とす翳りは header.css がヘッダーの下に引いているものと同じ。帯だけだと切り口が
 * 硬く、カードの縁に貼り付けた線に見える。
 */
function TopBand(): React.JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      <div
        style={{
          display: "flex",
          height: 10,
          width: "100%",
          background: `linear-gradient(90deg,${ACCENT},${SECONDARY},${PRIMARY},${HORIZON_INK},${ACCENT})`,
        }}
      />
      <div
        style={{
          display: "flex",
          height: 14,
          width: "100%",
          background: `linear-gradient(180deg,${withAlpha(HORIZON_INK, 0.12)},${withAlpha(HORIZON_INK, 0)})`,
        }}
      />
    </div>
  );
}

/**
 * カードの枠。街・やんてねくん・上端の帯を敷き、やんてねくんの右に中身を流す。
 *
 * やんてねくんは帯より先に置く。後に置いた要素が手前に描かれるので、帯が頭の天辺に
 * 重なる。逆に置くと、頭が帯を突き抜けてカードの縁まで出てしまい、上端の色の帯が
 * 途中で途切れて見える。
 */
function Frame({
  layout,
  children,
}: {
  layout: React.CSSProperties;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        background: "#ffffff",
        fontFamily: "'Noto Sans JP'",
      }}
    >
      <Cityscape />
      <Character />
      <TopBand />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          marginLeft: CONTENT_LEFT,
          ...layout,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * OG カード (Satori 制約: flex レイアウトのみ)。
 *
 * **HTML の文字列ではなく要素の木で渡す。** workers-og は文字列を HTMLRewriter で読み、
 * 流れてきた文字の塊をそのまま子に並べる。HTML は素材の data URI で大きいので、塊の
 * 切れ目が表題の途中に掛かることがあり、割れた表題は `lineClamp` を受け付けず
 * (子が 2 つ以上だと flex しか許されない)、flex では割れ目で段組みのように崩れる。
 * 要素の木なら表題は必ず 1 つの文字列として届く。
 *
 * 表題はカードの縦の真ん中に置き、日付をその上に添える。やんてねくんの指さす手が
 * ちょうどこの高さにあり、表題を指す形になる。表題が 1 行でも 3 行でも、塊ごと
 * 真ん中に着くので、手との位置関係は崩れない。下に 60px 余らせてあるのは、塊を
 * 少し持ち上げて手の高さに寄せるため。
 *
 * 表題は**実際の幅で 3 行に畳む** (`lineClamp`)。字数で切ると、細い英字の表題が
 * 2 行目の途中で切れ、全角の句読点が禁則で行を詰める表題は 4 行にはみ出す。
 * 空白の無い長い語 (識別子や URL) は `break-word` で折り返す。折らないとカードの外へ
 * 出ていく。
 *
 * 署名の字形は右上に貼る。右下はスカイツリーが立っていて、重ねると塔の線が字に
 * 絡んで読みにくい。
 */
export function cardElement(params: { title: string; date: string }): React.JSX.Element {
  const title = truncateByGrapheme(params.title, TITLE_MAX, { ellipsis: "…" });
  return (
    <Frame layout={{ justifyContent: "center", padding: "0 80px 60px 60px" }}>
      <div style={{ display: "flex", fontSize: 28, color: MUTED_INK, marginBottom: 16 }}>
        {params.date}
      </div>
      <div
        style={{
          display: "block",
          lineClamp: 3,
          fontSize: 48,
          fontWeight: 700,
          color: INK,
          lineHeight: 1.3,
          wordBreak: "break-word",
        }}
      >
        {title}
      </div>
      <div style={{ display: "flex", position: "absolute", right: 80, top: 64 }}>
        <Logotype height={44} />
      </div>
    </Frame>
  );
}

/**
 * サイト共通のデフォルト OG カード (記事以外のページ用)。
 *
 * 添える一文は ja.json の home.tagline と同じ。meta.description はこれに
 * 「エッセイ、技術記事、つくったもの。」を継いだもので、カードに収まる長さではないので、
 * トップの og:description に使っている短い方に合わせてある。
 *
 * 中身はやんてねくんの右の中央に置く。街のぶんだけ下に余白を取ると、その高さぶん字形が上へ
 * 押し上げられて、絵の重心が上に寄る。記事カードと同じく、街には重ねてよい。
 */
export function defaultCardElement(): React.JSX.Element {
  return (
    <Frame layout={{ alignItems: "center", justifyContent: "center" }}>
      <Logotype height={120} />
      <div style={{ display: "flex", fontSize: 30, color: MUTED_INK, marginTop: 32 }}>
        Web の向こうから
      </div>
    </Frame>
  );
}
