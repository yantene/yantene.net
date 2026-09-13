import type { IValueObject } from "~/backend/domain/shared";
import { InvalidEmailAddressError } from "./errors";

/**
 * 受け入れる形。`<ローカル部>@<ラベル>(.<ラベル>)+`。
 *
 * **RFC 5321 が許す形より狭い。** 引用符付きのローカル部もドット無しのドメインも
 * 落とす。ここを通ったアドレスは配信の宛先とログの識別子を兼ねるので、通す形は
 * 「実際に人が使っているアドレス」に絞っておくほうが事故が少ない。
 */
const pattern = /^[^\s@,;<>"]+@[^\s@,;<>".]+(?:\.[^\s@,;<>".]+)+$/;

/** RFC 5321 のパス長の上限。 */
const MAX_LENGTH = 254;

/**
 * ログインする人を指すメールアドレス。
 *
 * **このサイトでの身元はこれひとつ。** 役割 (管理者かどうか) はここに持たせず、
 * 要求のたびに引き比べる。焼き付けると、外した相手が入ったままになる (ADR 0039)。
 */
export class EmailAddress implements IValueObject<EmailAddress> {
  private constructor(private readonly value: string) {}

  /**
   * 打たれた文字列をアドレスにする。読めなければ {@link InvalidEmailAddressError}。
   *
   * **前後の空白を落とし、小文字に畳む。** ローカル部の大文字小文字を区別するのは
   * RFC 上は送り先の自由だが、実際に区別している配信先はまず無い。畳まないと
   * `Contact@` と `contact@` が別人になり、**同じ人が 2 通目のリンクで入れなくなる**。
   */
  static create(raw: string): EmailAddress {
    const normalized = raw.trim().toLowerCase();

    if (normalized.length > MAX_LENGTH) {
      throw new InvalidEmailAddressError("Email address is too long");
    }
    if (!pattern.test(normalized)) {
      throw new InvalidEmailAddressError("Email address is not in a form we accept");
    }

    return new EmailAddress(normalized);
  }

  /** 読めなければ undefined。打ち間違いを弾く入口で使う。 */
  static parse(raw: string): EmailAddress | undefined {
    try {
      return EmailAddress.create(raw);
    } catch (error) {
      if (error instanceof InvalidEmailAddressError) return undefined;
      throw error;
    }
  }

  toString(): string {
    return this.value;
  }

  equals(other: EmailAddress): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }
}
