import { charsetFor, decoderFor } from "./charset";
import { fetchCapped } from "./fetch-capped";
import { isAllowedImageType, mediaTypeOf } from "./image-content-type";
import { parseOgp } from "./parse-ogp";
import type {
  FetchedLinkCard,
  FetchedLinkCardImage,
  ILinkCardFetcher,
  LinkCardUrl,
} from "~/backend/domain/link-card";
import type { ILogger } from "~/backend/domain/shared";
import { errorToContext } from "~/backend/domain/shared";
import { truncateByGrapheme } from "~/lib/truncate";

const HTML_MAX_BYTES = 512 * 1024;
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const FAVICON_MAX_BYTES = 256 * 1024;

/** カードに載せる文字数の上限。相手の書きようで青天井にならないようにする。 */
const TITLE_MAX_CHARS = 200;
const DESCRIPTION_MAX_CHARS = 300;

/** OGP を探す相手。HTML 以外を渡されたら読まない。 */
const htmlContentTypes = new Set(["text/html", "application/xhtml+xml"]);

function isHtml(contentType: string): boolean {
  return htmlContentTypes.has(mediaTypeOf(contentType));
}

/** ページ内に書かれた URL を絶対 URL に直す。http(s) でなければ捨てる。 */
function toAbsolute(raw: string | undefined, base: string): string | undefined {
  if (raw === undefined) return undefined;
  try {
    const resolved = new URL(raw, base);
    if (resolved.protocol !== "http:" && resolved.protocol !== "https:") {
      return undefined;
    }
    return resolved.href;
  } catch {
    return undefined;
  }
}

/**
 * 相手の書きようで青天井にならないよう切り詰める。
 *
 * 数えるのは書記素。符号単位で切ると絵文字が半分に割れて豆腐になる (#300)。
 * ここで切った文字列がそのまま D1 に入り、一覧にも OGP にも出る。
 */
function truncate(value: string | undefined, max: number): string | undefined {
  if (value === undefined) return undefined;
  return truncateByGrapheme(value, max);
}

/**
 * OGP を読んでカードの材料を作る {@link ILinkCardFetcher} 実装。
 *
 * **この層は外部サイトの不調で throw しない** (ADR 0014)。相手が落ちている・OGP を
 * 持っていない・画像が大きすぎるといったことはどれも想定内なので、記録を残して
 * undefined を返す。このサイトの既定は fail-loud だが、外部依存はその例外に当たる。
 */
export class OgpLinkCardFetcher implements ILinkCardFetcher {
  constructor(private readonly logger: ILogger) {}

  async fetch(url: LinkCardUrl): Promise<FetchedLinkCard | undefined> {
    try {
      return await this.load(url);
    } catch (error) {
      this.logger.warn("link card fetch failed", {
        url: url.toString(),
        ...errorToContext(error),
      });
      return undefined;
    }
  }

  private async load(url: LinkCardUrl): Promise<FetchedLinkCard | undefined> {
    const page = await fetchCapped(url.toString(), {
      accept: "text/html,application/xhtml+xml",
      maxBytes: HTML_MAX_BYTES,
    });
    if (page === undefined || !isHtml(page.contentType)) return undefined;

    // 相手が名乗った文字コードで読む。UTF-8 決め打ちだと Shift_JIS や EUC-JP のページの
    // 題と説明が文字化けしたままカードに載る。ヘッダーが名乗らなければ本文の <meta> を見る。
    const decoder = decoderFor(charsetFor(page.contentType, page.bytes));
    const ogp = parseOgp(decoder.decode(page.bytes));
    // 題が無いページはカードにしようがない。素のリンクのままにする。
    if (ogp.title === undefined) return undefined;

    // 画像は取れなくてもカードは成立する。ここで諦めるのは画像だけ。
    const imageUrl = toAbsolute(ogp.imageUrl, page.url);
    const [image, favicon] = await Promise.all([
      this.loadAsset(imageUrl, IMAGE_MAX_BYTES),
      // rel=icon が書かれていなくても、慣例の位置に置かれていることが多い。
      this.loadAsset(
        toAbsolute(ogp.faviconUrl ?? "/favicon.ico", page.url),
        FAVICON_MAX_BYTES,
      ),
    ]);

    // 絵だけ取り逃したことを残す。カードは題と説明で成立するので先へ進むが、無音だと
    // 「絵の無いカード」と見分けが付かず、直すきっかけが無い (#255)。
    if (image.state === "missed") {
      this.logger.info("link card image not mirrored", {
        url: url.toString(),
        imageUrl,
      });
    }

    return {
      title: truncate(ogp.title, TITLE_MAX_CHARS) ?? ogp.title,
      description: truncate(ogp.description, DESCRIPTION_MAX_CHARS),
      siteName: truncate(ogp.siteName, TITLE_MAX_CHARS),
      image,
      favicon: favicon.state === "stored" ? favicon.asset : undefined,
    };
  }

  /**
   * 絵を 1 つ写す。
   *
   * 取れなかったこと (missed) と、載せる絵が無いこと (absent) を分けて返す。取り直す
   * 価値があるのは前者だけで、一緒くたにすると絵を持たない相手まで短い間隔で叩き直す
   * ことになる。
   */
  private async loadAsset(
    url: string | undefined,
    maxBytes: number,
  ): Promise<FetchedLinkCardImage> {
    // 書かれていない・http(s) で無い URL は、そもそも載せる絵が無いということ。
    if (url === undefined) return { state: "absent" };
    try {
      const response = await fetchCapped(url, {
        accept: "image/*",
        maxBytes,
      });
      // 取りに行って返ってこなかった (レート制限・不調・大きすぎ)。次は取れるかもしれない。
      if (response === undefined) return { state: "missed" };

      // 載せられない型 (SVG 等) は、取り直しても結論が変わらない。
      if (!isAllowedImageType(response.contentType)) return { state: "absent" };

      /*
       * 中身の無い 200 は「取れた」ことにしない。**absent ではなく missed。**
       *
       * absent にすると #255 の取り直しの対象から外れ、0 バイトの写しが 14 日の期限が
       * 切れるまでカードに出続ける。相手の一時的な不調で空を返すことはあるので、
       * 次は取れるかもしれない側に倒す。
       */
      if (response.bytes.byteLength === 0) return { state: "missed" };

      return {
        state: "stored",
        asset: {
          bytes: response.bytes,
          contentType: mediaTypeOf(response.contentType),
        },
      };
    } catch (error) {
      this.logger.debug("link card asset fetch failed", {
        url,
        ...errorToContext(error),
      });
      return { state: "missed" };
    }
  }
}
