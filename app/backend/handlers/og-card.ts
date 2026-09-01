// インライン SVG / CSS の高エントロピー文字列を秘匿情報と誤検知するため無効化 (このファイルは秘密を含まない)。
/**
 * OG カードの意匠。
 *
 * Satori に渡す静的な HTML を組み立てるだけで、配信も蓄えも知らない。相手は
 * og.handler.ts で、あちらは組み上がった HTML を PNG にして R2 に置く。
 *
 * 分けてあるのは、この 2 つが変わる理由が違うため。ここが動くのは見た目を変えたいとき、
 * あちらが動くのは経路や蓄え方を変えたいとき。no-secrets を切っているのもこちらの都合
 * (インライン SVG と CSS が高エントロピーの文字列に見える) で、ルータ側は見張られたままになる。
 */
import cityscapeSource from "~/frontend/assets/cityscape.svg?raw";
import highlightSource from "~/frontend/assets/highlight.svg?raw";
import { truncateByGrapheme } from "~/lib/truncate";

/*
 * 表題の上限。
 *
 * 字が入る幅は 1040px で、52px の全角なら 1 行 20 字。ここを 60 より上げると 4 行になり、
 * 足元 (日付・タグ・署名) との間が詰まって街の帯に触れる。字の大きさを変えるときは
 * 行数が 3 行に収まるかを一緒に見ること。
 */
const TITLE_MAX = 56;
/** カードのデザイン版。テンプレート/フォントを変えたら上げると全 OG が再生成される。 */
export const OG_TEMPLATE_VERSION = "v11";

/** yantene アイコン (data URI で OG カードに埋め込む)。 */
const YANTENE_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 67.733 67.733"><g transform="translate(-121.17 -27.445)"><path d="M73.685 39.527h135.467v67.733H73.685z" style="fill:#f8e5d6;fill-opacity:1;stroke-width:7.26443;stroke-linecap:square;stroke-linejoin:round;paint-order:stroke fill markers;stop-color:#000"/><path d="M73.685-28.206h135.467v67.733H73.685z" style="fill:#c9ab80;fill-opacity:1;stroke-width:7.26443;stroke-linecap:square;stroke-linejoin:round;paint-order:stroke fill markers;stop-color:#000"/><circle cx="88.27" cy="-72.048" r="39.677" style="fill:#c9ab80;fill-opacity:1;stroke-width:6.78952;stroke-linecap:square;stroke-linejoin:round;paint-order:stroke fill markers;stop-color:#000" transform="rotate(45)"/><circle cx="167.625" cy="-72.048" r="39.677" style="fill:#f8e5d6;fill-opacity:1;stroke-width:6.78952;stroke-linecap:square;stroke-linejoin:round;paint-order:stroke fill markers;stop-color:#000" transform="rotate(45)"/><path d="M159.46 46.99a14.817 14.74 0 0 1 12.379-6.118 14.817 14.74 0 0 1 12.066 6.708M125.887 41.94a14.817 14.74 0 0 1 13.395-3.669 14.817 14.74 0 0 1 10.561 8.981" style="fill:none;fill-opacity:1;stroke:#78a2d2;stroke-width:4.23333;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1;paint-order:stroke fill markers;stop-color:#000"/><path d="m128.378 51.872 16.39 5.9-16.08 7.858M180.139 53.64l-16.668 5.057 15.658 8.666" style="fill:none;stroke:#78a2d2;stroke-width:4.23334;stroke-linecap:round;stroke-linejoin:round;stroke-miterlimit:4;stroke-dasharray:none;stroke-opacity:1"/><path d="M143.31 78.073c-3.662 3.393-2.03 25.136 6.81 26.34 8.842 1.204 15.08-18.378 12.73-22.413s-15.876-7.32-19.54-3.927" style="fill:#d47d7d;fill-opacity:1;stroke:none;stroke-width:.529166px;stroke-linecap:butt;stroke-linejoin:miter;stroke-opacity:1"/></g></svg>`;
/**
 * アイコンの data URI。**最初にカードを描くときまで遅らせる。**
 *
 * このファイルは og.handler.ts 経由で index.ts から静的に繋がっているので、モジュールの
 * 評価はページ表示でもフィード取得でも走る。2 KB の SVG の URI エンコードを、カードを
 * 描かない要求にまで負わせない (街と手書きの線を artwork に寄せてあるのと同じ理由。
 * こちらだけ素のトップレベルに残っていた)。
 */
function iconDataUri(): string {
  artwork.icon ??= `data:image/svg+xml,${encodeURIComponent(YANTENE_ICON_SVG)}`;
  return artwork.icon;
}

/*
 * カードの配色。app.css の daisyUI テーマ (name: "yantene") と、地平線を引いている
 * header.css から取ってある。あちらは色を実行時の custom property と color-mix で
 * 組み立てるが、ここは Satori に渡す静的な HTML なのでどちらも使えない。白地に
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
/** タグの色 (note-timeline.css のタグと同じ base-content 55%)。 */

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
 * 素材から、カードに要るところだけを取り出す。
 *
 * 落とすのは 2 つ。先頭に付いている素材の注記 (1.5 KB) は、data URI に入れても誰も
 * 読まないうえ、`currentColor` の語を含むので下の色の焼き込みに巻き込まれる。雲は流れる
 * ことで雲に見える意匠 (hero-section.css がひと巡り 4 日かけて動かしている) なので、
 * 止まった絵では建物と同じ細さの線が空の途中に散らばっているようにしか見えない。
 *
 * 素材が再エクスポートされて印 (`id="clouds"` / `id="skyline"`) が変わったら、雲が
 * 落ちずに戻ってくる。絵が少し騒がしくなるだけなので、ここでは throw せずそのまま通す。
 */
function skylineOnly(source: string): string {
  const opening = source.indexOf("<svg");
  const body = opening === -1 ? source : source.slice(opening);
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

/*
 * 素材から組み立てた画。最初にカードを描くときまで遅らせる。
 *
 * このファイルは og.handler.ts 経由で index.ts から静的に繋がっているので、モジュールの
 * 評価はページ表示でもフィード取得でも走る。29 KB の置換と URI エンコードを、カードを
 * 描かない要求にまで負わせない (同じ理由で workers-og は動的 import にしてある)。
 *
 * 評価そのものを遅らせる余地はまだ残っている ([#301](https://github.com/yantene/yantene.net/issues/301))。
 */
const artwork: { cityscape?: string; marker?: string; icon?: string } = {};

/**
 * カードの足元に敷く街。幅いっぱいに置き、下端 (素材では地平線) をカードの底に合わせる。
 *
 * 通常の流れから外して底に貼ってあるのは、日付から署名までの一行を街に重ねられるように
 * するため。線が薄いので重なっても字は読める (画面のヒーローも同じ扱いで、
 * hero-section.css が「テキストを街の上に逃がすとヒーローが間延びする」と書いている)。
 */
function cityscapeHtml(): string {
  artwork.cityscape ??= `<img src="data:image/svg+xml,${encodeURIComponent(cityscapeSvg())}" width="1200" height="${CITYSCAPE_HEIGHT.toString()}" style="position:absolute;left:0;bottom:0;" />`;
  return artwork.cityscape;
}

/*
 * 見出しの下に敷く手書きのマーカー。ヒーローとヘッダーのロゴに敷いてあるものと同じ。
 *
 * 画面では絶対配置した SVG を字の背後へ回しているが、ここでは字の背景に敷く。Satori の
 * 絶対配置は基準になる箱の幅を字から取れず、字の幅を自分で見積もって渡す羽目になる
 * (実際、見積もった幅のまま右へはみ出した)。背景なら箱の幅にそのまま追随する。
 *
 * 素材は `preserveAspectRatio="none"` で伸ばす前提なので、横は箱いっぱいに伸ばす。
 * はみ出しと高さの比 (0.12em / 0.4em / 0.06em) は hero-section.css と header.css から。
 */
function markerDataUri(): string {
  artwork.marker ??= `data:image/svg+xml,${encodeURIComponent(highlightSource)}`;
  return artwork.marker;
}

/** 寸法を CSS の長さにする (テンプレートに数値をそのまま置くと lint が止める)。 */
function px(value: number): string {
  // 端数を落とす。0.4 倍のような掛け算がそのままだと 13.600000000000001px になる。
  return `${(Math.round(value * 100) / 100).toString()}px`;
}

/** マーカーを敷いた「やんてね」。字の大きさだけを受ける。 */
function markedNameHtml(fontSize: number): string {
  // 字の両端から少しはみ出させて、手で引いた線らしくする (画面と同じ 0.12em)。
  const bleed = fontSize * 0.12;
  const markerHeight = fontSize * 0.4;
  // 字の下端から 0.06em の高さに置く。背景は上端からの距離で指定する。
  const markerTop = fontSize - markerHeight - fontSize * 0.06;
  return `
    <div style="display:flex;font-size:${px(fontSize)};font-weight:700;color:${INK};line-height:1;padding:0 ${px(bleed)};margin:0 ${px(-bleed)};background-image:url('${markerDataUri()}');background-size:100% ${px(markerHeight)};background-repeat:no-repeat;background-position:0 ${px(markerTop)};">やんてね</div>`;
}

/** 記事カードの署名 (アイコンを添えた横並びのロゴ)。 */
function wordmarkHtml(fontSize: number): string {
  const iconSize = Math.round(fontSize * 1.65);
  return `
    <div style="display:flex;align-items:center;">
      <img src="${iconDataUri()}" width="${iconSize.toString()}" height="${iconSize.toString()}" style="border-radius:${px(Math.round(iconSize * 0.21))};margin-right:${px(Math.round(fontSize * 0.47))};" />
      ${markedNameHtml(fontSize)}
    </div>`;
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
const TOP_BAND_HTML = `
  <div style="display:flex;flex-direction:column;width:100%;">
    <div style="display:flex;height:10px;width:100%;background:linear-gradient(90deg,${ACCENT},${SECONDARY},${PRIMARY},${HORIZON_INK},${ACCENT});"></div>
    <div style="display:flex;height:14px;width:100%;background:linear-gradient(180deg,${withAlpha(HORIZON_INK, 0.12)},${withAlpha(HORIZON_INK, 0)});"></div>
  </div>`;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * OG カードの HTML (Satori 制約: flex レイアウトのみ)。
 *
 * 日付から署名までの一行は、表題が何行になってもカードの決まった高さに置く。上下に
 * 振り分ける (`space-between`) だけだと、表題が短いときにこの行が真ん中まで上がってきて、
 * 記事ごとに居場所が変わる。
 *
 * 下の余白が 30px しかないのは、その一行を街の高さまで下ろすため。街は通常の流れから
 * 外して底に貼ってあるので、ここで場所を空けておく必要がない。線画に重なるが、線が薄い
 * ぶん字は読める (画面のヒーローも同じ扱いにしてある)。
 */
export function cardHtml(params: { title: string; date: string }): string {
  const title = escapeHtml(truncateByGrapheme(params.title, TITLE_MAX, { ellipsis: "…" }));
  return `
    <div style="position:relative;display:flex;flex-direction:column;width:1200px;height:630px;background:#ffffff;font-family:'Noto Sans JP';">
      ${cityscapeHtml()}
      ${TOP_BAND_HTML}
      <div style="display:flex;flex-direction:column;flex:1;justify-content:space-between;padding:44px 80px 30px;">
        <div style="display:flex;font-size:52px;font-weight:700;color:${INK};line-height:1.3;">${title}</div>
        <div style="display:flex;align-items:flex-end;justify-content:space-between;">
          <div style="display:flex;flex-direction:column;">
            <div style="display:flex;font-size:26px;color:${MUTED_INK};">${escapeHtml(params.date)}</div>
          </div>
          ${wordmarkHtml(34)}
        </div>
      </div>
    </div>`;
}

/**
 * サイト共通のデフォルト OG カード (記事以外のページ用)。
 *
 * 添える一文は ja.json の home.tagline と同じ。meta.description はこれに
 * 「エッセイ、技術記事、つくったもの。」を継いだもので、カードに収まる長さではないので、
 * トップの og:description に使っている短い方に合わせてある。
 *
 * 中身はカードの中央に置く。街のぶんだけ下に余白を取ると、その高さぶんロゴが上へ
 * 押し上げられて、絵の重心が上に寄る。記事カードと同じく、街には重ねてよい。
 */
export function defaultCardHtml(): string {
  return `
    <div style="position:relative;display:flex;flex-direction:column;width:1200px;height:630px;background:#ffffff;font-family:'Noto Sans JP';">
      ${cityscapeHtml()}
      ${TOP_BAND_HTML}
      <div style="display:flex;flex:1;flex-direction:column;align-items:center;justify-content:center;">
        <img src="${iconDataUri()}" width="132" height="132" style="border-radius:26px;margin-bottom:32px;" />
        ${markedNameHtml(76)}
        <div style="display:flex;font-size:30px;color:${MUTED_INK};margin-top:24px;">Web の向こうから</div>
      </div>
    </div>`;
}
