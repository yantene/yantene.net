import type { ProfileName } from "./profile-name.vo";
import type { SocialLink } from "./social-link";
import type { Temporal } from "@js-temporal/polyfill";

/**
 * 書き手のプロフィール。コンテンツリポジトリの `profile.md` 1 つに対応する。
 *
 * **`IPersisted` / `IUnpersisted` で分けていない。** 記事と違って行は 1 つに固定されて
 * おり (D1 側で `id = 1` を強制する)、DB が採番する値も、保存の前後で型が変わる値も
 * 無い。分ける理由が無いところに分けると、読む側が場合分けを強いられるだけになる。
 *
 * 本文 (経歴と好きなもの) は MDAST として R2 にあり、このエンティティは持たない。
 * 記事の末尾やトップのヒーローが読むのは短い自己紹介までで、本文を読むのは `/about`
 * だけなので、毎回同じ場所から一緒に運ぶ理由が無い。
 */
export class Profile {
  private constructor(
    private readonly fields: {
      readonly name: ProfileName;
      readonly dateOfBirth: Temporal.PlainDate;
      readonly birthplace: string | undefined;
      readonly tagline: string;
      readonly socials: readonly SocialLink[];
      readonly sourceHash: string;
    },
  ) {}

  static create(params: {
    name: ProfileName;
    dateOfBirth: Temporal.PlainDate;
    birthplace: string | undefined;
    tagline: string;
    socials: readonly SocialLink[];
    sourceHash: string;
  }): Profile {
    return new Profile(params);
  }

  get name(): ProfileName {
    return this.fields.name;
  }

  get dateOfBirth(): Temporal.PlainDate {
    return this.fields.dateOfBirth;
  }

  /** 出身地。フロントマターに `birthplace` が無ければ undefined。 */
  get birthplace(): string | undefined {
    return this.fields.birthplace;
  }

  /** 短い自己紹介。改行を含む (書いたとおりの行で出す)。 */
  get tagline(): string {
    return this.fields.tagline;
  }

  get socials(): readonly SocialLink[] {
    return this.fields.socials;
  }

  /**
   * コンテンツリポジトリ (`profile.md`) のリビジョン識別子。refresh 時の変更検出に使う。
   */
  get sourceHash(): string {
    return this.fields.sourceHash;
  }
}
