/**
 * HTML から OGP と favicon の在りかを読み取る純関数。
 *
 * 見るのは Open Graph のメタデータだけで、oEmbed も JSON-LD も追わない。カードを自前で
 * 描く以上、必要なのは題・説明・画像・サイト名だけで、プロバイダの埋め込み HTML は要らない
 * (ADR 0013)。
 *
 * HTML パーサを積まず自前で拾っているのは、欲しいのが `<head>` の平たいタグ数個で、
 * 入れ子や整形式性を判断する必要が無いため。壊れた HTML から誤って拾っても、出るのは
 * カードの題が変になる程度で、実行される場所は無い。
 */

/** `<meta ...>` と `<link ...>` を拾う。属性の中に `>` は書けない前提で足りる。 */
const voidTagPattern = /<(meta|link)\s([^>]*)>/gi;

const titlePattern = /<title[^>]*>([^<]*)</i;

const entityPattern = /&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g;

/** 数値文字参照と、HTML に頻出する名前付き実体だけを戻す。 */
const namedEntities: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

const MAX_CODE_POINT = 0x10_ff_ff;

export function decodeHtmlEntities(value: string): string {
  return value.replaceAll(entityPattern, (match, body: string) => {
    if (!body.startsWith("#")) {
      return namedEntities[body.toLowerCase()] ?? match;
    }
    const isHex = body.charAt(1).toLowerCase() === "x";
    const digits = isHex ? body.slice(2) : body.slice(1);
    const code = Number.parseInt(digits, isHex ? 16 : 10);
    if (!Number.isSafeInteger(code) || code < 0 || code > MAX_CODE_POINT) {
      return match;
    }
    return String.fromCodePoint(code);
  });
}

const QUOTES = new Set(['"', "'"]);

/** 走査の結果と、次に読む位置。 */
interface Scanned {
  readonly text: string;
  readonly next: number;
}

function isSpace(character: string): boolean {
  return character !== "" && character.trim() === "";
}

/** 属性名の終わりになる文字。HTML の字句規則のうち、必要なぶんだけを見る。 */
function isNameBoundary(character: string): boolean {
  return (
    character === "=" ||
    character === "/" ||
    character === ">" ||
    isSpace(character)
  );
}

function skipSpaces(raw: string, from: number): number {
  let index = from;
  while (index < raw.length && isSpace(raw.charAt(index))) index += 1;
  return index;
}

function readName(raw: string, from: number): Scanned {
  let index = from;
  while (index < raw.length && !isNameBoundary(raw.charAt(index))) index += 1;
  return { text: raw.slice(from, index), next: index };
}

/** `=` の直後から値を読む。引用符があればその中を、無ければ空白か `>` の手前までを採る。 */
function readValue(raw: string, from: number): Scanned {
  const start = skipSpaces(raw, from);
  const quote = raw.charAt(start);

  if (QUOTES.has(quote)) {
    let index = start + 1;
    while (index < raw.length && raw.charAt(index) !== quote) index += 1;
    // 閉じ引用符のぶん 1 つ進める (閉じられていなければ終端に居る)。
    return { text: raw.slice(start + 1, index), next: index + 1 };
  }

  let index = start;
  while (
    index < raw.length &&
    !isSpace(raw.charAt(index)) &&
    raw.charAt(index) !== ">"
  ) {
    index += 1;
  }
  return { text: raw.slice(start, index), next: index };
}

/**
 * タグの属性列を名前と値に分ける。
 *
 * 正規表現ではなく 1 文字ずつ進める。`name="value"` を正規表現で書くと「名前の連なりの
 * 後に `=`」という形になり、`=` を含まない長い断片に当たったときに後戻りが効いて
 * 読み取りが入力長の二乗に近づく。ここは相手の HTML をそのまま流し込む場所なので、
 * 入力の形で速度が変わらない書き方にしておく。
 */
function parseAttributes(raw: string): ReadonlyMap<string, string> {
  const attributes = new Map<string, string>();
  let index = 0;

  while (index < raw.length) {
    const name = readName(raw, skipSpaces(raw, index));
    if (name.text === "") {
      // 名前として読めない文字 (`/` など) は 1 つ進めて読み飛ばす。
      index = name.next + 1;
      continue;
    }

    const afterName = skipSpaces(raw, name.next);
    const value =
      raw.charAt(afterName) === "="
        ? readValue(raw, afterName + 1)
        : { text: "", next: afterName };
    index = value.next;

    // 同じ属性が 2 度書かれていたら先に出たほうを採る (HTML の解釈に合わせる)。
    const key = name.text.toLowerCase();
    if (!attributes.has(key)) {
      attributes.set(key, decodeHtmlEntities(value.text));
    }
  }

  return attributes;
}

/** favicon として使えそうな rel か。`rel="shortcut icon"` のような複数語にも合わせる。 */
function isIconRel(rel: string): boolean {
  return rel
    .toLowerCase()
    .split(/\s+/)
    .some((token) => ["icon", "shortcut"].includes(token));
}

export interface OgpMetadata {
  readonly title: string | undefined;
  readonly description: string | undefined;
  readonly siteName: string | undefined;
  /** ページ内に書かれたままの URL。相対パスのこともある。 */
  readonly imageUrl: string | undefined;
  readonly faviconUrl: string | undefined;
}

/**
 * HTML から OGP を読む。
 *
 * og:* が無ければ `<title>` と `<meta name="description">` で代える。題が全く無い
 * ページはカードにできないので、呼び出し側が undefined として扱えるよう title は
 * undefined のまま返す。
 */
export function parseOgp(html: string): OgpMetadata {
  const meta = new Map<string, string>();
  let faviconUrl: string | undefined;

  for (const match of html.matchAll(voidTagPattern)) {
    const [, tagName, rawAttributes] = match;
    const attributes = parseAttributes(rawAttributes);

    if (tagName.toLowerCase() === "meta") {
      // OGP は property、通常のメタデータは name に載る。どちらも同じ表に入れる。
      const key = attributes.get("property") ?? attributes.get("name");
      const content = attributes.get("content");
      if (key === undefined || content === undefined) continue;
      const normalized = key.toLowerCase();
      if (!meta.has(normalized)) meta.set(normalized, content);
      continue;
    }

    const rel = attributes.get("rel");
    const href = attributes.get("href");
    // 先に出てきた icon を採る。サイズ違いが並ぶことがあるが、選り分ける必要はない。
    if (rel !== undefined && href !== undefined && isIconRel(rel)) {
      faviconUrl ??= href;
    }
  }

  const rawTitle = titlePattern.exec(html)?.[1];
  const fallbackTitle =
    rawTitle === undefined ? undefined : decodeHtmlEntities(rawTitle);

  return {
    title: firstNonEmpty(meta.get("og:title"), fallbackTitle),
    description: firstNonEmpty(
      meta.get("og:description"),
      meta.get("description"),
    ),
    siteName: firstNonEmpty(meta.get("og:site_name")),
    imageUrl: firstNonEmpty(meta.get("og:image"), meta.get("og:image:url")),
    faviconUrl: firstNonEmpty(faviconUrl),
  };
}

function firstNonEmpty(...values: (string | undefined)[]): string | undefined {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed !== undefined && trimmed.length > 0) return trimmed;
  }
  return undefined;
}
