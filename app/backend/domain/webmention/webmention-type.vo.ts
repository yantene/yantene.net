import { InvalidWebmentionTypeError } from "./errors";
import type { IValueObject } from "~/backend/domain/shared";

/**
 * Webmention の種別。
 *
 * microformats2 のどのプロパティで target を指しているかで決まる
 * (`u-in-reply-to` → reply、`u-like-of` → like、`u-repost-of` → repost)。
 * どれでもないただのリンクは mention。
 */
const TYPES = ["reply", "like", "repost", "mention"] as const;

export type WebmentionTypeName = (typeof TYPES)[number];

const known: ReadonlySet<string> = new Set(TYPES);

export class WebmentionType implements IValueObject<WebmentionType> {
  private constructor(private readonly value: WebmentionTypeName) {}

  /** 文字列から作る。知らない種別なら throw (保存済みの行の破損検知を兼ねる)。 */
  static create(raw: string): WebmentionType {
    if (!known.has(raw)) {
      throw new InvalidWebmentionTypeError(
        `Unsupported webmention type: ${raw}`,
      );
    }
    return new WebmentionType(raw as WebmentionTypeName);
  }

  static reply(): WebmentionType {
    return new WebmentionType("reply");
  }

  static like(): WebmentionType {
    return new WebmentionType("like");
  }

  static repost(): WebmentionType {
    return new WebmentionType("repost");
  }

  /** 種別を決められないときの既定。ただのリンクとして扱う。 */
  static mention(): WebmentionType {
    return new WebmentionType("mention");
  }

  equals(other: WebmentionType): boolean {
    return this.value === other.value;
  }

  toString(): WebmentionTypeName {
    return this.value;
  }

  toJSON(): WebmentionTypeName {
    return this.value;
  }
}
