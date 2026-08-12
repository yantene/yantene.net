import type { IValueObject } from "~/backend/domain/shared";
import { allowedEmoji } from "~/lib/emoji/allowed-emoji";

/*
 * 受け入れる絵文字の集合。
 *
 * 一覧そのものは app/lib に置いてある。パレット (フロント) が出す集合と、サーバーが
 * 受け入れる集合は同じでなければならず、片方だけを直せてしまう置き方にしたくないため。
 * データは技術に依存しないただの並びなので、ドメインから参照しても依存の向きは崩れない。
 */
const allowed = new Set(allowedEmoji);

/** 既定のリアクション。ハートを押すと「いいね」になる。 */
const LIKE = "❤️";

export class InvalidReactionEmojiError extends Error {
  readonly name = "InvalidReactionEmojiError";
}

/**
 * リアクションに使う絵文字。
 *
 * 受け入れるのは一覧に**完全一致**するものだけ。肌の色や髪の色の派生は一覧に無いので、
 * ここで弾かれる。異体字セレクタの有無で表記が揺れるものも一覧の形に揃える必要がある
 * (揺れたまま通すと、同じ絵文字が別々の行に積まれて数が割れる)。
 */
export class ReactionEmoji implements IValueObject<ReactionEmoji> {
  private constructor(private readonly value: string) {}

  /** 受け取った文字列を検証する。一覧に無ければ throw。 */
  static create(raw: string): ReactionEmoji {
    if (!allowed.has(raw)) {
      throw new InvalidReactionEmojiError(`Unsupported emoji: ${raw}`);
    }
    return new ReactionEmoji(raw);
  }

  /**
   * 既定のリアクション (いいね)。
   *
   * 検証を素通りさせず create を通す。ここだけ抜け道にすると、一覧から外れた絵文字が
   * 既定として書き込まれ、読み戻すときに落ちる (作れるのに読めない値ができる)。
   */
  static like(): ReactionEmoji {
    return this.create(LIKE);
  }

  equals(other: ReactionEmoji): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }
}
