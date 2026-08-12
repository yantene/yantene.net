import { fetchCapped } from "./fetch-capped";
import { parseOgp } from "./parse-ogp";
import type {
  FetchedLinkCard,
  ILinkCardFetcher,
  LinkCardAsset,
  LinkCardUrl,
} from "~/backend/domain/link-card";
import type { ILogger } from "~/backend/domain/shared";
import { errorToContext } from "~/backend/domain/shared";

const HTML_MAX_BYTES = 512 * 1024;
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const FAVICON_MAX_BYTES = 256 * 1024;

/** カードに載せる文字数の上限。相手の書きようで青天井にならないようにする。 */
const TITLE_MAX_CHARS = 200;
const DESCRIPTION_MAX_CHARS = 300;

/** OGP を探す相手。HTML 以外を渡されたら読まない。 */
const htmlContentTypes = new Set(["text/html", "application/xhtml+xml"]);

/*
 * 写してよい画像の種類。
 *
 * **SVG は受け入れない。** カード自体は `<img>` で描くのでスクリプトは動かないが、
 * 写した先は自分のオリジンなので、配信 URL を直接開かれるとスクリプト入りの SVG が
 * 自分のオリジンで実行されうる。favicon が SVG しかないサイトはアイコン無しのカードに
 * なるが、絵ひとつのために穴を開ける理由がない。
 */
const allowedImageTypes: ReadonlySet<string> = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/avif",
  "image/x-icon",
  "image/vnd.microsoft.icon",
]);

/** Content-Type からパラメータ (charset 等) を落として型だけにする。 */
function mediaTypeOf(contentType: string): string {
  return (contentType.split(";", 1)[0] ?? "").trim().toLowerCase();
}

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

function truncate(value: string | undefined, max: number): string | undefined {
  if (value === undefined) return undefined;
  return value.length <= max ? value : value.slice(0, max);
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

    const ogp = parseOgp(new TextDecoder().decode(page.bytes));
    // 題が無いページはカードにしようがない。素のリンクのままにする。
    if (ogp.title === undefined) return undefined;

    // 画像は取れなくてもカードは成立する。ここで諦めるのは画像だけ。
    const [image, favicon] = await Promise.all([
      this.loadAsset(toAbsolute(ogp.imageUrl, page.url), IMAGE_MAX_BYTES),
      // rel=icon が書かれていなくても、慣例の位置に置かれていることが多い。
      this.loadAsset(
        toAbsolute(ogp.faviconUrl ?? "/favicon.ico", page.url),
        FAVICON_MAX_BYTES,
      ),
    ]);

    return {
      title: truncate(ogp.title, TITLE_MAX_CHARS) ?? ogp.title,
      description: truncate(ogp.description, DESCRIPTION_MAX_CHARS),
      siteName: truncate(ogp.siteName, TITLE_MAX_CHARS),
      image,
      favicon,
    };
  }

  private async loadAsset(
    url: string | undefined,
    maxBytes: number,
  ): Promise<LinkCardAsset | undefined> {
    if (url === undefined) return undefined;
    try {
      const response = await fetchCapped(url, {
        accept: "image/*",
        maxBytes,
      });
      if (response === undefined) return undefined;

      const contentType = mediaTypeOf(response.contentType);
      if (!allowedImageTypes.has(contentType)) return undefined;

      return { bytes: response.bytes, contentType };
    } catch (error) {
      this.logger.debug("link card asset fetch failed", {
        url,
        ...errorToContext(error),
      });
      return undefined;
    }
  }
}
