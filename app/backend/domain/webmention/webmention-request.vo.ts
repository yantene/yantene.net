import {
  InvalidWebmentionUrlError,
  SameSourceAndTargetError,
  SelfMentionNotAcceptedError,
  TargetNotOnThisSiteError,
} from "./errors";
import { WebmentionUrl } from "./webmention-url.vo";
import type { IValueObject } from "~/backend/domain/shared";
import {
  ARTICLE_PATH_PREFIX,
  FORMER_ARTICLE_PATH_PREFIX,
  InvalidNoteSlugError,
  NoteSlug,
  slugsMovedFromNotes,
} from "~/backend/domain/note";

interface RequestFields {
  readonly source: WebmentionUrl;
  readonly targetSlug: NoteSlug;
  readonly target: WebmentionUrl;
}

/**
 * 送り手から届いた (source, target) の組。
 *
 * 生成できた時点で、送り手を待たせている間にできる検証はすべて済んでいる。
 * 「source を実際に取りに行って target へのリンクを確かめる」ところから先は
 * 相手のサーバー次第で時間がかかるので、ここでは行わない (非同期段の仕事)。
 *
 * ノートが実在するかまでは見ない。それには永続化層が要り、ドメインの外だから。
 */
export class WebmentionRequest implements IValueObject<WebmentionRequest> {
  private constructor(private readonly fields: RequestFields) {}

  /**
   * 受け取ったフォームの値を検証する。受け取れないものは
   * {@link WebmentionRejectedError} 系の typed error で throw する。
   *
   * @param siteOrigin このサイト自身の origin。target がここのノートを指しているか、
   *   source がこのサイト自身でないかの判定に使う。
   */
  static create(params: {
    source: unknown;
    target: unknown;
    siteOrigin: string;
  }): WebmentionRequest {
    const source = readUrl(params.source, "source");
    const target = readUrl(params.target, "target");

    if (source.pointsToSameDocument(target)) {
      throw new SameSourceAndTargetError("source and target must differ");
    }

    const site = readUrl(params.siteOrigin, "siteOrigin");
    if (target.origin !== site.origin) {
      throw new TargetNotOnThisSiteError(`target is not on this site: ${target.toString()}`);
    }

    const article = articleFrom(target.pathname);
    if (article === undefined) {
      throw new TargetNotOnThisSiteError(`target is not an article URL: ${target.toString()}`);
    }

    /*
     * 自分で自分に送る mention は受けない。記事どうしのリンクで勝手に増えるだけで、
     * 読み手にとっての意味が無い。
     *
     * 見るのは origin ではなくホスト名。origin だとスキームを http に変えるだけで
     * ここを抜けてしまい、記事ページは自分自身への canonical リンクを出しているので
     * その先の検証も素通りする (source はクエリで幾らでも変えられるので、自分の名前の
     * 行を好きなだけ積める)。転送の追い先もホスト名で見ており (検証段)、同じ「自分の
     * サイトかどうか」を二か所で別の軸で測ると、片方に穴が開く。
     */
    if (source.hostname === site.hostname) {
      throw new SelfMentionNotAcceptedError("source must not be on this site");
    }

    return new WebmentionRequest({
      source,
      targetSlug: article.slug,
      /*
       * 送り手の書いた表記ではなく、スラグから組み直した URL を持つ。末尾のスラッシュや
       * クエリの有無で、リンクの照合が揺れないようにするため。
       *
       * 接頭辞だけは送り手の書いたものを残す。`/notes/<slug>` から移した記事に旧 URL 宛てで
       * 届いたとき、送り手のページに書かれているのは旧 URL なので、正規の `/articles/` に
       * 組み直すとリンクの照合で必ず落ちる。保存する行はスラグで引くので、どちらの接頭辞
       * でも同じ記事に付く。
       */
      target: WebmentionUrl.create(`${site.origin}${article.prefix}${article.slug.toString()}`),
    });
  }

  get source(): WebmentionUrl {
    return this.fields.source;
  }

  get targetSlug(): NoteSlug {
    return this.fields.targetSlug;
  }

  /**
   * スラグから組み直した target URL。送り手のページとの照合に使う。
   *
   * 接頭辞は送り手の書いたとおり (`/articles/` か、移した記事の `/notes/`)。
   */
  get target(): WebmentionUrl {
    return this.fields.target;
  }

  equals(other: WebmentionRequest): boolean {
    return (
      this.fields.source.equals(other.fields.source) &&
      this.fields.targetSlug.equals(other.fields.targetSlug)
    );
  }

  toJSON(): { source: string; target: string } {
    return {
      source: this.fields.source.toString(),
      target: this.fields.target.toString(),
    };
  }
}

/** フォームの値を URL として読む。読めなければ、どちらの欄かが分かる形で throw。 */
function readUrl(raw: unknown, field: string): WebmentionUrl {
  if (typeof raw !== "string" || raw.trim().length === 0) {
    throw new InvalidWebmentionUrlError(`${field} is required`);
  }
  try {
    return WebmentionUrl.create(raw);
  } catch (error) {
    if (error instanceof InvalidWebmentionUrlError) {
      throw new InvalidWebmentionUrlError(`${field}: ${error.message}`);
    }
    throw error;
  }
}

/** target のパスから読み取った記事。接頭辞は送り手が書いたもの。 */
interface ArticleTarget {
  readonly prefix: string;
  readonly slug: NoteSlug;
}

/**
 * 記事の URL のパスからスラグを取り出す。記事の URL でなければ undefined。
 *
 * 受けるのは `/articles/<slug>` と、そこへ移した記事に限って `/notes/<slug>`
 * (domain/note/article-path.ts の表)。移していない記事を `/notes/<slug>` で指されても
 * 受けない。`/notes/` は短文の投稿に譲る場所で、そちらの識別子と記事のスラグを同じ
 * 接頭辞の下で取り違えないようにするため。
 */
function articleFrom(pathname: string): ArticleTarget | undefined {
  const canonical = slugUnder(ARTICLE_PATH_PREFIX, pathname);
  if (canonical !== undefined) return { prefix: ARTICLE_PATH_PREFIX, slug: canonical };

  const former = slugUnder(FORMER_ARTICLE_PATH_PREFIX, pathname);
  if (former === undefined || !slugsMovedFromNotes.has(former.toString())) return undefined;
  return { prefix: FORMER_ARTICLE_PATH_PREFIX, slug: former };
}

/** `<prefix><slug>` の形ならスラグを、そうでなければ undefined を返す。 */
function slugUnder(prefix: string, pathname: string): NoteSlug | undefined {
  if (!pathname.startsWith(prefix)) return undefined;

  // 末尾のスラッシュだけは許す (`/articles/hello/`)。それ以外の階層は別の資源。
  const rest = pathname.slice(prefix.length).replace(/\/$/, "");
  if (rest.length === 0 || rest.includes("/")) return undefined;

  try {
    return NoteSlug.create(decodeURIComponent(rest));
  } catch (error) {
    if (error instanceof InvalidNoteSlugError) return undefined;
    // decodeURIComponent は壊れたパーセント符号で URIError を投げる。
    if (error instanceof URIError) return undefined;
    throw error;
  }
}
