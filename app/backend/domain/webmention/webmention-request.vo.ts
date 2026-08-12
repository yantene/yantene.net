import {
  InvalidWebmentionUrlError,
  SameSourceAndTargetError,
  SelfMentionNotAcceptedError,
  TargetNotOnThisSiteError,
} from "./errors";
import { WebmentionUrl } from "./webmention-url.vo";
import type { IValueObject } from "~/backend/domain/shared";
import { InvalidNoteSlugError, NoteSlug } from "~/backend/domain/note";

/** ノートの URL の形。ここに載っていない target は受け取らない。 */
const NOTE_PATH_PREFIX = "/notes/";

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

    const siteOrigin = readUrl(params.siteOrigin, "siteOrigin").origin;
    if (target.origin !== siteOrigin) {
      throw new TargetNotOnThisSiteError(
        `target is not on this site: ${target.toString()}`,
      );
    }

    const targetSlug = noteSlugFrom(target.pathname);
    if (targetSlug === undefined) {
      throw new TargetNotOnThisSiteError(
        `target is not a note URL: ${target.toString()}`,
      );
    }

    /*
     * 自分で自分に送る mention は受けない。記事どうしのリンクで勝手に増えるだけで、
     * 読み手にとっての意味が無い。
     */
    if (source.origin === siteOrigin) {
      throw new SelfMentionNotAcceptedError("source must not be on this site");
    }

    return new WebmentionRequest({
      source,
      targetSlug,
      // 送り手の書いた表記ではなく、スラグから組み直した正規の URL を持つ。
      // 末尾のスラッシュやクエリの有無で、リンクの照合が揺れないようにするため。
      target: WebmentionUrl.create(
        `${siteOrigin}${NOTE_PATH_PREFIX}${targetSlug.toString()}`,
      ),
    });
  }

  get source(): WebmentionUrl {
    return this.fields.source;
  }

  get targetSlug(): NoteSlug {
    return this.fields.targetSlug;
  }

  /** スラグから組み直した、正規の target URL。 */
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

/** `/notes/<slug>` からスラグを取り出す。ノートの URL でなければ undefined。 */
function noteSlugFrom(pathname: string): NoteSlug | undefined {
  if (!pathname.startsWith(NOTE_PATH_PREFIX)) return undefined;

  // 末尾のスラッシュだけは許す (`/notes/hello/`)。それ以外の階層は別の資源。
  const rest = pathname.slice(NOTE_PATH_PREFIX.length).replace(/\/$/, "");
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
