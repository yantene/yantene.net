import type { IValueObject } from "~/backend/domain/shared";

/*
 * 使った技術の名前の並び。書いた順に札として出る。
 *
 * 名前は表示する字そのもの (`Cloudflare Workers`) で、正規化しない。タグのように
 * 引く口は無いので、表記の揺れを揃える理由がまだ無い。
 *
 * **同じ名前を 2 つ書いたら弾く。** 札が 2 枚並ぶのは書き手の誤りで、黙って 1 枚に
 * 畳むと、直したつもりの誤りが原文に残り続ける。
 */
const MAX_ITEMS = 20;
const MAX_ITEM_LENGTH = 40;

export class InvalidWorkStackError extends Error {
  readonly name = "InvalidWorkStackError";
}

export class WorkStack implements IValueObject<WorkStack> {
  private constructor(private readonly items: readonly string[]) {}

  /** 何も書いていない作品の並び。 */
  static empty(): WorkStack {
    return new WorkStack([]);
  }

  static create(raw: readonly string[]): WorkStack {
    if (raw.length > MAX_ITEMS) {
      throw new InvalidWorkStackError(`Work stack must have at most ${String(MAX_ITEMS)} items`);
    }
    const items = raw.map((item) => requireItem(item));
    if (new Set(items).size !== items.length) {
      throw new InvalidWorkStackError("Work stack must not repeat the same item");
    }
    return new WorkStack(items);
  }

  toArray(): readonly string[] {
    return this.items;
  }

  equals(other: WorkStack): boolean {
    return (
      this.items.length === other.items.length &&
      this.items.every((item, index) => item === other.items[index])
    );
  }

  toJSON(): readonly string[] {
    return this.items;
  }
}

function requireItem(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_ITEM_LENGTH || trimmed.includes("\n")) {
    throw new InvalidWorkStackError(
      `Work stack item must be a single line of 1..${String(MAX_ITEM_LENGTH)} characters, got ${JSON.stringify(raw)}`,
    );
  }
  return trimmed;
}
