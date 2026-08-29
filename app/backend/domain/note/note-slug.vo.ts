import type { IValueObject } from "~/backend/domain/shared";

// スラグは URL パスセグメントに乗る識別子。小文字英数字とハイフンのみ許可する。
// ハイフンの位置制約 (先頭・末尾・連続の禁止) はネストした量指定子の正規表現で
// まとめて表現すると ReDoS 検知に触れるため、単純な文字クラス検査 + 個別チェックに分ける。
const slugCharsPattern = /^[a-z0-9-]+$/;
const MAX_LENGTH = 200;

export class InvalidNoteSlugError extends Error {
  readonly name = "InvalidNoteSlugError";
}

export class NoteSlug implements IValueObject<NoteSlug> {
  private constructor(private readonly value: string) {}

  static create(raw: string): NoteSlug {
    const trimmed = raw.trim().toLowerCase();
    if (trimmed.length === 0 || trimmed.length > MAX_LENGTH) {
      throw new InvalidNoteSlugError(`Note slug must be 1..${String(MAX_LENGTH)} characters long`);
    }
    if (
      !slugCharsPattern.test(trimmed) ||
      trimmed.startsWith("-") ||
      trimmed.endsWith("-") ||
      trimmed.includes("--")
    ) {
      throw new InvalidNoteSlugError(
        "Note slug must be lowercase alphanumerics separated by single hyphens",
      );
    }
    return new NoteSlug(trimmed);
  }

  /**
   * 読めればスラグ、読めなければ undefined。
   *
   * **握るのはスラグとして読めなかったときだけで、それ以外の失敗は投げる。** 一緒に
   * 握ると、想定外の失敗が「そんな記事は無い」の顔をして静かに通る (fail-loud)。
   * 実際、同じ処理が 5 か所に写されていた頃、1 か所だけ `catch {}` で全部を握って
   * いた (#291)。
   *
   * 返すのは「読めたか」だけ。undefined を 404 にするか別の応答にするかは、受け取る
   * 側 (handlers) の関心なのでここでは決めない。
   */
  static parse(raw: string): NoteSlug | undefined {
    try {
      return this.create(raw);
    } catch (error) {
      if (error instanceof InvalidNoteSlugError) return undefined;
      throw error;
    }
  }

  toString(): string {
    return this.value;
  }

  equals(other: NoteSlug): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }
}
