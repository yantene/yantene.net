/**
 * ネゴシエーションで原文とみなす媒体型。
 *
 * `text/x-markdown` (登録されていない事実上の別名) や `text/plain` は採らない。
 * 別名を受けたくなったら、ここを配列にして完全一致の最大値を取る形に広げる。
 */
const MARKDOWN_MEDIA_TYPE = "text/markdown";

/** 既定の表現 (記事ページ)。Markdown はこれを厳密に上回ったときだけ選ばれる。 */
const HTML_MEDIA_TYPE = "text/html";

/** q が書かれていない / 読めないときの品質値 (RFC 9110 §12.4.2)。 */
const DEFAULT_QUALITY = 1;

/** `Accept` に並ぶ媒体範囲 1 つぶん。 */
interface MediaRange {
  /** 小文字化した `type/subtype`。パラメータは落としてある。 */
  readonly essence: string;
  /** [0, 1] に丸めた q 値。 */
  readonly quality: number;
}

/**
 * パラメータ列から q 値を取り出す。
 *
 * 読めない q (`;q=abc`) は「書かれていない」と同じ 1 として扱う。壊れた指定を 0 に
 * 倒すと、名指ししてきた相手を黙って HTML に落とすことになるため。
 */
function parseQuality(parameters: readonly string[]): number {
  for (const parameter of parameters) {
    const [name, ...rest] = parameter.split("=");
    if (name.trim().toLowerCase() !== "q") continue;

    // 値なしの `;q=` は先に弾く。Number("") は 0 になるので、そのまま通すと
    // 「読めない q」が拒否の意思表示に化ける。
    const raw = rest.join("=").trim();
    if (raw.length === 0) return DEFAULT_QUALITY;

    const parsed = Number(raw);
    if (Number.isNaN(parsed)) return DEFAULT_QUALITY;
    return Math.min(Math.max(parsed, 0), 1);
  }
  return DEFAULT_QUALITY;
}

/** 媒体範囲 1 つを読む。`garbage` / `text/` / `/markdown` のような壊れた指定は捨てる。 */
function parseMediaRange(entry: string): MediaRange | undefined {
  const [rawEssence, ...parameters] = entry.split(";");
  const essence = rawEssence.trim().toLowerCase();

  const parts = essence.split("/");
  if (parts.length !== 2) return undefined;
  if (parts[0].length === 0 || parts[1].length === 0) return undefined;

  return { essence, quality: parseQuality(parameters) };
}

/**
 * `Accept` を媒体範囲の列に分解する。
 *
 * 正規表現は使わない。ネストした量指定子で書くと ReDoS 検知の誤検知に触れるため
 * (note-slug.vo.ts と同じ事情)。引用文字列の中のカンマ・セミコロンは扱わない割り切り
 * (Accept に引用付きパラメータが来ることは実際上なく、resolve-locale.ts の
 * Accept-Language も同じ割り切りをしている)。
 */
function parseAcceptHeader(header: string): readonly MediaRange[] {
  return header
    .split(",")
    .map((entry) => parseMediaRange(entry))
    .filter((range) => range !== undefined);
}

/** `patterns` を書いた順 (具体性の高い順) に探し、最初に見つけた媒体範囲の q を返す。 */
function qualityOf(
  ranges: readonly MediaRange[],
  patterns: readonly string[],
): number {
  for (const pattern of patterns) {
    // 同じ範囲が重複していたら先勝ち (`text/markdown;q=0, text/markdown` は 0)。
    const matched = ranges.find((range) => range.essence === pattern);
    if (matched !== undefined) return matched.quality;
  }
  return 0;
}

/** 完全一致する媒体範囲の q。ワイルドカードは数えない。 */
function exactQuality(
  ranges: readonly MediaRange[],
  mediaType: string,
): number {
  return qualityOf(ranges, [mediaType]);
}

/** ワイルドカードも含めた q。`type/subtype` → `type/*` → 全体一致 の順に探す。 */
function negotiatedQuality(
  ranges: readonly MediaRange[],
  mediaType: string,
): number {
  const [type] = mediaType.split("/");
  return qualityOf(ranges, [mediaType, `${type}/*`, "*/*"]);
}

/**
 * `Accept` が記事の原文 Markdown を名指ししているかを判定する。
 *
 * 記事 URL (`/notes/<slug>`) は同じ URL で HTML と Markdown の 2 表現を持つ (ADR 0020)。
 * どちらを返すかの判断はここだけに閉じてあり、Hono にも Env にも依らない。
 *
 * 判定は次のとおり。
 *
 *     qMD   = text/markdown に完全一致する媒体範囲の q (無ければ 0)
 *     qHTML = text/html にマッチする最も具体的な媒体範囲の q
 *     Markdown ⟺ qMD > 0 かつ qMD > qHTML
 */
export function isMarkdownPreferred(accept: string | undefined): boolean {
  if (accept === undefined) return false;

  const ranges = parseAcceptHeader(accept);

  // ワイルドカードを非対称に扱うのが肝。ワイルドカードは「サーバーが選べ」の意思表示
  // なので既定 (HTML) に倒し、Markdown は名指しでしか取れないようにする。ブラウザの
  // Accept は必ず全体一致のワイルドカードを含むので、ここを緩めると全訪問者に原文が
  // 配られる。同点も同じ理由で HTML に倒す。
  const markdownQuality = exactQuality(ranges, MARKDOWN_MEDIA_TYPE);
  if (markdownQuality === 0) return false;

  return markdownQuality > negotiatedQuality(ranges, HTML_MEDIA_TYPE);
}
