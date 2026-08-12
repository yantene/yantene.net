import { InvalidWebmentionUrlError } from "./errors";
import type { IValueObject } from "~/backend/domain/shared";

/**
 * 受け入れる URL の長さの上限。
 *
 * 外から来る文字列をそのまま D1 に積むので、ここで頭を押さえる。実在する URL は
 * まず届かない長さで、それより長いものは送り手の事故か嫌がらせのどちらかしかない。
 */
const MAX_LENGTH = 2000;

/** 受け入れるスキーム。Webmention の仕様どおり http / https に限る。 */
const allowedProtocols: ReadonlySet<string> = new Set(["http:", "https:"]);

/**
 * Webmention が扱う絶対 URL (source / target / 著者のページや画像)。
 *
 * 生成できた時点で「絶対 URL で、http か https で、長すぎない」ことが保証される。
 * 値は `URL` の正規化を通したもの (大文字のホスト名やスキームは小文字に揃う) なので、
 * 同じ資源を指す表記の揺れで別物として数えられることがない。
 */
export class WebmentionUrl implements IValueObject<WebmentionUrl> {
  private constructor(private readonly value: string) {}

  /** 受け取った文字列を検証する。絶対 URL でなければ throw。 */
  static create(raw: string): WebmentionUrl {
    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_LENGTH) {
      throw new InvalidWebmentionUrlError(
        `Webmention URL must be 1..${String(MAX_LENGTH)} characters long`,
      );
    }

    const parsed = parseAbsolute(trimmed);
    if (parsed === undefined) {
      throw new InvalidWebmentionUrlError(`Not an absolute URL: ${trimmed}`);
    }
    if (!allowedProtocols.has(parsed.protocol)) {
      throw new InvalidWebmentionUrlError(
        `Webmention URL must be http or https: ${trimmed}`,
      );
    }
    return new WebmentionUrl(parsed.href);
  }

  /**
   * 検証を通ったものだけを返す。通らなければ undefined。
   *
   * 外部サイトから読み取った著者の URL や画像のように、「読めたら使う、読めなければ
   * 無いものとして続ける」場所で使う。source / target の検証には使わない
   * (そちらは送り手に理由を返す必要があるので throw させる)。
   */
  static parse(raw: unknown): WebmentionUrl | undefined {
    if (typeof raw !== "string") return undefined;
    try {
      return this.create(raw);
    } catch (error) {
      if (error instanceof InvalidWebmentionUrlError) return undefined;
      throw error;
    }
  }

  /** スキームとホストの部分 (例: `https://example.com`)。 */
  get origin(): string {
    return new URL(this.value).origin;
  }

  /** パス部分 (例: `/notes/hello`)。 */
  get pathname(): string {
    return new URL(this.value).pathname;
  }

  /**
   * 同じ資源を指すかどうかを、クエリ・素片・末尾のスラッシュを落として比べる。
   *
   * 送り手が付ける計測用のクエリや、記事内の見出しへの素片で「別の URL」に
   * なってしまうと、リンクしているのにリンクしていないと判定される。
   */
  pointsToSameDocument(other: WebmentionUrl): boolean {
    return (
      this.origin === other.origin &&
      trimTrailingSlash(this.pathname) === trimTrailingSlash(other.pathname)
    );
  }

  equals(other: WebmentionUrl): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }
}

/** 絶対 URL として読めれば返す。相対 URL や壊れた文字列は undefined。 */
function parseAbsolute(raw: string): URL | undefined {
  try {
    return new URL(raw);
  } catch {
    return undefined;
  }
}

/** 末尾のスラッシュを 1 つだけ落とす。ルート (`/`) はそのまま。 */
function trimTrailingSlash(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname;
}
