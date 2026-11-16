import type { IValueObject } from "~/backend/domain/shared";

// スラグは URL パスセグメントに乗る識別子。小文字英数字とハイフンのみ許可する。
// ハイフンの位置制約 (先頭・末尾・連続の禁止) はネストした量指定子の正規表現で
// まとめて表現すると ReDoS 検知に触れるため、単純な文字クラス検査 + 個別チェックに分ける。
//
// `ArticleSlug` や `WorkSlug` と規則は同じだが型は分ける。片方の集約の識別子をもう片方に渡せて
// しまうと、`/articles/<slug>` と `/slides/<slug>` を取り違えても型が黙って通る。
const slugCharsPattern = /^[a-z0-9-]+$/;
const MAX_LENGTH = 200;

export class InvalidSlideSlugError extends Error {
  readonly name = "InvalidSlideSlugError";
}

export class SlideSlug implements IValueObject<SlideSlug> {
  private constructor(private readonly value: string) {}

  static create(raw: string): SlideSlug {
    const trimmed = raw.trim().toLowerCase();
    if (trimmed.length === 0 || trimmed.length > MAX_LENGTH) {
      throw new InvalidSlideSlugError(
        `Slide slug must be 1..${String(MAX_LENGTH)} characters long`,
      );
    }
    if (
      !slugCharsPattern.test(trimmed) ||
      trimmed.startsWith("-") ||
      trimmed.endsWith("-") ||
      trimmed.includes("--")
    ) {
      throw new InvalidSlideSlugError(
        "Slide slug must be lowercase alphanumerics separated by single hyphens",
      );
    }
    return new SlideSlug(trimmed);
  }

  /**
   * 読めればスラグ、読めなければ undefined。
   *
   * **握るのはスラグとして読めなかったときだけで、それ以外の失敗は投げる。** 一緒に
   * 握ると、想定外の失敗が「そんなスライドは無い」の顔をして静かに通る (fail-loud)。
   * 記事側で同じ作法が崩れて #291 になった経緯があるので、写すときも必ず持ち越す。
   */
  static parse(raw: string): SlideSlug | undefined {
    try {
      return this.create(raw);
    } catch (error) {
      if (error instanceof InvalidSlideSlugError) return undefined;
      throw error;
    }
  }

  toString(): string {
    return this.value;
  }

  equals(other: SlideSlug): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }
}
