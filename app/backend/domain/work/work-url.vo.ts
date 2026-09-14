import type { IValueObject } from "~/backend/domain/shared";

/*
 * 作品そのものの在り処。GitHub のリポジトリ、公開しているサイト、gem の頁など。
 *
 * **省略できる。** 外に出していないものも「作ったもの」ではあるので、リンクの無い
 * 作品を書けないようにはしない (省略の扱いは呼び出し側が持つ)。
 *
 * スキームは http(s) だけ通す。`javascript:` を弾くのが目的で、コンテンツリポジトリに
 * 書けるのは書き手だけだが、打ち間違いがそのまま href に乗る経路をドメインの外に
 * 作らない (`SocialAccount` と同じ線引き)。
 */
const MAX_LENGTH = 2048;

export class InvalidWorkUrlError extends Error {
  readonly name = "InvalidWorkUrlError";
}

export class WorkUrl implements IValueObject<WorkUrl> {
  private constructor(private readonly value: string) {}

  static create(raw: string): WorkUrl {
    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_LENGTH) {
      throw new InvalidWorkUrlError(`Work URL must be 1..${String(MAX_LENGTH)} characters long`);
    }
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new InvalidWorkUrlError(`Work URL must be an absolute URL, got ${trimmed}`);
    }
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      throw new InvalidWorkUrlError(`Work URL must be http(s), got ${parsed.protocol}`);
    }
    return new WorkUrl(trimmed);
  }

  toString(): string {
    return this.value;
  }

  equals(other: WorkUrl): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }
}
