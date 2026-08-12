import { toPlainText } from "./plain-text";
import type { IValueObject } from "~/backend/domain/shared";

/**
 * 保存する本文の長さの上限。
 *
 * 返信の要旨が伝わればよく、全文を持つ必要はない (読みたければ source を開ける)。
 * 上限を置かないと、1 通の Webmention で相手のページ全体を積まれてしまう。
 */
const MAX_LENGTH = 1000;

/**
 * Webmention として受け取った本文。
 *
 * 生成の時点で HTML を落としてテキストにし、上限で切る。表示する側は素の文字列として
 * 扱ってよい (逆に、ここを通さない文字列を保存してはならない)。
 */
export class WebmentionContent implements IValueObject<WebmentionContent> {
  private constructor(private readonly value: string) {}

  /**
   * 外部サイトから読み取った文字列から作る。均した結果が空なら undefined。
   *
   * 空を弾くのに throw を使わないのは、本文の無い Webmention (いいね等) が
   * 異常ではないため。「無い」ことを型で持たせて呼び出し側に選ばせる。
   */
  static fromText(raw: string): WebmentionContent | undefined {
    const text = toPlainText(raw, MAX_LENGTH);
    return text.length === 0 ? undefined : new WebmentionContent(text);
  }

  /**
   * 保存済みの値から戻す。均し直さない。
   *
   * 保存の時点で均してあるので、読むたびに掛け直すと**読んだ値が保存した値と変わる**。
   * 均した結果には `<` や `>` が文字として残りうるため (`&lt;script&gt;` を戻したもの
   * など)、掛け直すとそれをタグと見なして落としてしまう。
   */
  static reconstruct(value: string): WebmentionContent | undefined {
    return value.length === 0 ? undefined : new WebmentionContent(value);
  }

  equals(other: WebmentionContent): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return this.value;
  }

  toJSON(): string {
    return this.value;
  }
}
