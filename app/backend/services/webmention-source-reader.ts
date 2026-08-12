import { Temporal } from "@js-temporal/polyfill";
import { mf2 } from "microformats-parser";
import {
  WebmentionAuthor,
  WebmentionContent,
  WebmentionType,
  WebmentionUrl,
} from "~/backend/domain/webmention";

/**
 * 開きタグらしき並び。`<` に続けて英字で始まり、次の `>` までを 1 つと数える。
 *
 * リンクを探すのにタグの中だけを見るのは、本文に書かれた `href=` の**字面**を
 * 拾わないため。「この URL へは絶対にリンクしない」と書いただけの記事を
 * 「リンクしている」と読んでしまうと、検証の意味が無くなる。
 */
const tagPattern = /<[a-zA-Z][^>]*>/g;

/** タグの中の `href` / `src` の値。引用符あり・なしの両方を拾う。 */
const urlAttributePattern =
  /\b(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/gi;

/** microformats2 のプロパティと、そこから決まる種別。上にあるものを優先する。 */
const typeByProperty = [
  ["in-reply-to", (): WebmentionType => WebmentionType.reply()],
  ["repost-of", (): WebmentionType => WebmentionType.repost()],
  ["like-of", (): WebmentionType => WebmentionType.like()],
] as const;

/** microformats-parser が返す構造。型は公開されていないので戻り値から借りる。 */
type Mf2Document = ReturnType<typeof mf2>;
type Mf2Root = Mf2Document["items"][number];
type Mf2Property = Mf2Root["properties"][string][number];

/** source から読み取った、1 通ぶんの中身。 */
export interface ParsedMention {
  readonly type: WebmentionType;
  readonly author: WebmentionAuthor;
  readonly content: WebmentionContent | undefined;
  readonly publishedAt: Temporal.Instant | undefined;
}

/**
 * source が target を実際にリンクしているか。
 *
 * Webmention に必須の検証。これを省くと、誰でも好きな URL を source と称して投げる
 * だけで、こちらの記事に他人の名前で行を作れてしまう。
 *
 * @param baseUrl 相対リンクの解決基準 (転送を追い切ったあとの source の URL)。
 */
export function hasLinkToTarget(
  html: string,
  baseUrl: WebmentionUrl,
  target: WebmentionUrl,
): boolean {
  return extractLinkedUrls(html, baseUrl).some((url) =>
    url.pointsToSameDocument(target),
  );
}

/**
 * microformats2 から種別・著者・本文・公開日時を読む。
 *
 * mf2 の印が何も付いていない普通のページも相手にするので、読めないものは黙って
 * 欠かす。種別が決まらなければ「ただの言及 (mention)」に倒す。
 */
export function readMention(
  html: string,
  baseUrl: WebmentionUrl,
  target: WebmentionUrl,
): ParsedMention {
  const document = parseDocument(html, baseUrl);
  const entries = collectEntries(document.items);
  const entry = pickEntry(entries, baseUrl, target);

  if (entry === undefined) {
    return {
      type: WebmentionType.mention(),
      author: authorOf(undefined, document),
      content: undefined,
      publishedAt: undefined,
    };
  }

  return {
    type: typeOf(entry, target) ?? WebmentionType.mention(),
    author: authorOf(entry, document),
    content: contentOf(entry),
    publishedAt: publishedAtOf(entry),
  };
}

/**
 * mf2 として読む。読めなければ空の結果にする。
 *
 * 壊れた HTML を送ってくる相手は珍しくない。パースに失敗しても、リンクの検証さえ
 * 通っていれば「ただの言及」として残す価値があるので、ここでは throw させない
 * (fail-loud の例外。理由は IWebmentionSourceFetcher の注記と同じ)。
 */
function parseDocument(html: string, baseUrl: WebmentionUrl): Mf2Document {
  try {
    return mf2(html, { baseUrl: baseUrl.toString() });
  } catch {
    return { rels: {}, "rel-urls": {}, items: [] };
  }
}

/** h-entry を、入れ子になっているものも含めて集める。 */
function collectEntries(roots: readonly Mf2Root[]): Mf2Root[] {
  return roots.flatMap((root) => [
    ...(root.type?.includes("h-entry") === true ? [root] : []),
    ...collectEntries(root.children ?? []),
  ]);
}

/**
 * この Webmention の主役になる h-entry を選ぶ。
 *
 * 1. target を `u-in-reply-to` 等で名指ししているもの
 * 2. 本文の中で target にリンクしているもの
 * 3. h-entry が 1 つしか無ければそれ
 *
 * 並んでいるうちのどれとも結び付かないときは選ばない。索引ページのように h-entry が
 * 並ぶ相手で先頭を拾うと、target とは無関係な記事の著者と本文を保存してしまう。
 */
function pickEntry(
  entries: readonly Mf2Root[],
  baseUrl: WebmentionUrl,
  target: WebmentionUrl,
): Mf2Root | undefined {
  return (
    entries.find((entry) => typeOf(entry, target) !== undefined) ??
    entries.find((entry) => {
      const html = contentHtmlOf(entry);
      return html !== undefined && hasLinkToTarget(html, baseUrl, target);
    }) ??
    (entries.length === 1 ? entries.at(0) : undefined)
  );
}

/** target を名指ししているプロパティから種別を決める。名指しが無ければ undefined。 */
function typeOf(
  entry: Mf2Root,
  target: WebmentionUrl,
): WebmentionType | undefined {
  const hit = typeByProperty.find(([property]) =>
    propertyUrls(entry, property).some((url) =>
      url.pointsToSameDocument(target),
    ),
  );
  return hit?.[1]();
}

/** 著者。h-entry に無ければ、ページ全体を代表する h-card に頼る。 */
function authorOf(
  entry: Mf2Root | undefined,
  document: Mf2Document,
): WebmentionAuthor {
  const card =
    (entry === undefined
      ? undefined
      : rootOf(firstProperty(entry, "author"))) ??
    document.items.find((item) => item.type?.includes("h-card") === true);

  if (card === undefined) {
    // h-card が無くても、文字列で名乗っていることはある。
    const raw =
      entry === undefined ? undefined : firstProperty(entry, "author");
    return typeof raw === "string"
      ? WebmentionAuthor.create({ name: raw })
      : WebmentionAuthor.anonymous();
  }

  return WebmentionAuthor.create({
    name: textOf(firstProperty(card, "name")),
    url: propertyUrls(card, "url").at(0),
    photo: propertyUrls(card, "photo").at(0),
  });
}

/**
 * 本文。`e-content` を優先し、無ければ `p-summary` で代える。
 *
 * `p-name` は見ない。microformats2 は名前の無い h-entry に本文から**推測した**名前を
 * 与えるので、いいねのように本文を持たない mention でも「like」のようなリンクの
 * 文字列が名前として出てきてしまう。それを本文として保存すると、画面には送り手が
 * 書いていない言葉が並ぶ。
 */
function contentOf(entry: Mf2Root): WebmentionContent | undefined {
  for (const property of ["content", "summary"]) {
    const text = textOf(firstProperty(entry, property));
    if (text === undefined) continue;
    const content = WebmentionContent.fromText(text);
    if (content !== undefined) return content;
  }
  return undefined;
}

/** 送り元の記事の公開日時。読めなければ undefined。 */
function publishedAtOf(entry: Mf2Root): Temporal.Instant | undefined {
  const raw = textOf(firstProperty(entry, "published"));
  if (raw === undefined) return undefined;

  try {
    return Temporal.Instant.from(raw);
  } catch {
    // 時刻や時差の無い "2026-08-01" 形式。その日の始まり (UTC) として扱う。
    try {
      return Temporal.PlainDate.from(raw).toZonedDateTime("UTC").toInstant();
    } catch {
      return undefined;
    }
  }
}

/** `e-content` の生 HTML。リンクを探すのに使う。 */
function contentHtmlOf(entry: Mf2Root): string | undefined {
  const value = firstProperty(entry, "content");
  if (typeof value !== "object") return undefined;
  const html = (value as { html?: unknown }).html;
  return typeof html === "string" ? html : undefined;
}

/**
 * そのプロパティの値を並べる。無ければ空。
 *
 * 型の上では任意の名前で必ず引ける辞書だが、実際には持っていないプロパティの方が
 * 多い。持っている組から探すことで、無いときを型の上でも「無い」として扱う。
 */
function propertyValues(root: Mf2Root, name: string): readonly Mf2Property[] {
  const entry = Object.entries(root.properties).find(([key]) => key === name);
  return entry?.[1] ?? [];
}

function firstProperty(root: Mf2Root, name: string): Mf2Property | undefined {
  return propertyValues(root, name).at(0);
}

/** そのプロパティが指す URL を並べる。文字列でも入れ子の h-* でも読む。 */
function propertyUrls(root: Mf2Root, name: string): WebmentionUrl[] {
  return propertyValues(root, name)
    .map((value) => WebmentionUrl.parse(urlStringOf(value)))
    .filter((url) => url !== undefined);
}

/** 値が指す URL の文字列。h-cite / h-card なら中の `url` を見る。 */
function urlStringOf(value: Mf2Property): string | undefined {
  if (typeof value === "string") return value;

  const record = value as { value?: unknown; properties?: unknown };
  const nested = rootOf(value);
  if (nested !== undefined) {
    const url = propertyValues(nested, "url").at(0);
    if (typeof url === "string") return url;
  }
  return typeof record.value === "string" ? record.value : undefined;
}

/** 入れ子の microformat (h-card / h-cite) なら返す。 */
function rootOf(value: Mf2Property | undefined): Mf2Root | undefined {
  if (value === undefined || typeof value !== "object") return undefined;
  const record = value as { properties?: unknown };
  return typeof record.properties === "object" && record.properties !== null
    ? (value as Mf2Root)
    : undefined;
}

/** 値をテキストとして読む。`e-*` や画像は中の `value` を見る。 */
function textOf(value: Mf2Property | undefined): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "string") return value;

  const inner = (value as { value?: unknown }).value;
  return typeof inner === "string" ? inner : undefined;
}

/** タグの中の href / src を集め、絶対 URL に直す。 */
function extractLinkedUrls(
  html: string,
  baseUrl: WebmentionUrl,
): WebmentionUrl[] {
  const urls: WebmentionUrl[] = [];
  for (const tag of html.matchAll(tagPattern)) {
    const attributes = tag[0].matchAll(urlAttributePattern);
    for (const attribute of attributes) {
      // 引用符あり (1, 2) と引用符なし (3) のうち、実際に噛んだ組だけが値を持つ。
      const raw = attribute.at(1) ?? attribute.at(2) ?? attribute.at(3);
      const url = raw === undefined ? undefined : resolveUrl(raw, baseUrl);
      if (url !== undefined) urls.push(url);
    }
  }
  return urls;
}

/** 属性の値を絶対 URL に直す。相対でも絶対でも受ける。 */
function resolveUrl(
  raw: string,
  baseUrl: WebmentionUrl,
): WebmentionUrl | undefined {
  // 属性値の中で実体参照として書かれるのは、実質 `&` だけ。
  const candidate = raw.trim().replaceAll("&amp;", "&");
  if (candidate.length === 0) return undefined;

  try {
    return WebmentionUrl.parse(new URL(candidate, baseUrl.toString()).href);
  } catch {
    return undefined;
  }
}
