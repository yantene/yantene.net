import { InvalidLinkCardUrlError } from "./errors";
import type { IValueObject } from "~/backend/domain/shared";

/** カードにできるスキーム。取りに行く先なので http(s) に限る。 */
const allowedProtocols: ReadonlySet<string> = new Set(["http:", "https:"]);

/**
 * リンクカードの対象 URL。
 *
 * **本文に書かれた文字列をそのまま持つ。正規化しない。** カードは URL をキーにして
 * 引くので、保存する側 (refresh) と描画側 (本文の MDAST) が同じ文字列に辿り着けることが
 * 何より要る。片方だけが正規化すると、取れているのに引けないカードが静かに増える。
 *
 * 同じページを別の書き方 (末尾スラッシュの有無など) で貼れば行が 2 つできるが、
 * 取得が 1 回増えるだけで害は無い。
 */
export class LinkCardUrl implements IValueObject<LinkCardUrl> {
  private constructor(private readonly value: string) {}

  static create(raw: string): LinkCardUrl {
    let parsed: URL;
    try {
      parsed = new URL(raw);
    } catch {
      throw new InvalidLinkCardUrlError(`Not a valid URL: ${raw}`);
    }
    if (!allowedProtocols.has(parsed.protocol)) {
      throw new InvalidLinkCardUrlError(`Unsupported protocol: ${raw}`);
    }
    return new LinkCardUrl(raw);
  }

  equals(other: LinkCardUrl): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }
}
