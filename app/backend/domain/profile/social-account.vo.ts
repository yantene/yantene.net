import type { IValueObject } from "~/backend/domain/shared";
import type { SocialPlatform } from "~/lib/social-platforms";
import { isSocialPlatform } from "~/lib/social-platforms";

/*
 * 出ていく先 1 つ。
 *
 * 種類の一覧は app/lib に置いてある。サーバーが受け入れる集合と、アイコンを持っている
 * 集合が同じでなければならず、片方だけを直せてしまう置き方にしたくないため。データは
 * 技術に依存しないただの並びなので、ドメインから参照しても依存の向きは崩れない
 * (`ReactionEmoji` と同じ形)。
 *
 * `isMe` は「これは自分のアカウントである」という主張 (`rel="me"`)。主張は相手側からの
 * 相互リンクがあって初めて成り立つので、書き手が先方のプロフィールに yantene.net を
 * 書いた先にだけ立てる。
 *
 * ⚠️ **`email` だけはよその会社のアカウントではなく、連絡先である** (#514)。
 * 通すスキームが違うので、下の `ALLOWED_PROTOCOLS` が種別ごとに見分ける。
 */
const MAX_URL_LENGTH = 2048;

export class UnknownSocialPlatformError extends Error {
  readonly name = "UnknownSocialPlatformError";
}

export class InvalidSocialUrlError extends Error {
  readonly name = "InvalidSocialUrlError";
}

interface SocialAccountFields {
  readonly platform: SocialPlatform;
  readonly url: string;
  readonly isMe: boolean;
}

export class SocialAccount implements IValueObject<SocialAccount> {
  private constructor(private readonly fields: SocialAccountFields) {}

  static create(params: { platform: string; url: string; isMe: boolean }): SocialAccount {
    const platform = params.platform.trim().toLowerCase();
    if (!isSocialPlatform(platform)) {
      throw new UnknownSocialPlatformError(`Unknown social platform: ${params.platform}`);
    }
    return new SocialAccount({
      platform,
      url: validateUrl(params.url, platform),
      isMe: params.isMe,
    });
  }

  get platform(): SocialPlatform {
    return this.fields.platform;
  }

  get url(): string {
    return this.fields.url;
  }

  get isMe(): boolean {
    return this.fields.isMe;
  }

  equals(other: SocialAccount): boolean {
    return (
      this.fields.platform === other.fields.platform &&
      this.fields.url === other.fields.url &&
      this.fields.isMe === other.fields.isMe
    );
  }

  toJSON(): Record<string, unknown> {
    return { platform: this.fields.platform, url: this.fields.url, isMe: this.fields.isMe };
  }
}

/**
 * 通すスキームを種別ごとに決める。
 *
 * **`email` だけが `mailto:` で、残りは http(s)。** どちらか一方に寄せない。
 *
 * - 全部に `mailto:` を許すと、`platform: github` に `mailto:` を書けてしまう。
 *   押した人のメーラーが開き、GitHub の印が付いた連絡先という嘘になる
 * - `email` に http(s) を許すと、封筒の絵で Web ページに飛ばせてしまう
 */
const ALLOWED_PROTOCOLS: Record<SocialPlatform, readonly string[]> = {
  github: ["https:", "http:"],
  x: ["https:", "http:"],
  bluesky: ["https:", "http:"],
  mastodon: ["https:", "http:"],
  discord: ["https:", "http:"],
  email: ["mailto:"],
};

/**
 * 出ていく先なので絶対 URL。スキームは種別ごとの許可だけ通す。
 *
 * `javascript:` を弾くのが目的。コンテンツリポジトリに書けるのは書き手だけだが、打ち間違いが
 * そのまま href に乗る経路をドメインの外に作らない。
 */
function validateUrl(raw: string, platform: SocialPlatform): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_URL_LENGTH) {
    throw new InvalidSocialUrlError(
      `Social URL must be 1..${String(MAX_URL_LENGTH)} characters long`,
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new InvalidSocialUrlError(`Social URL must be an absolute URL, got ${trimmed}`);
  }
  const allowed = ALLOWED_PROTOCOLS[platform];
  if (!allowed.includes(parsed.protocol)) {
    throw new InvalidSocialUrlError(
      `Social URL for ${platform} must be one of ${allowed.join(" ")}, got ${parsed.protocol}`,
    );
  }
  /*
   * `mailto:` は宛先が空でも URL として成立してしまう (`new URL("mailto:")` は通る)。
   * そのまま出すと、押しても宛先の無いメーラーが開く。
   *
   * **アドレスの書式そのものは見ない。** 正規表現で判ろうとすると、厳しすぎて正しい
   * アドレスを弾くか、緩すぎて意味が無いかのどちらかになる。ここで止めたいのは
   * 「書き忘れ」なので、宛先があって `@` を含むことだけを確かめる。
   */
  if (parsed.protocol === "mailto:" && !parsed.pathname.includes("@")) {
    throw new InvalidSocialUrlError(`Social URL for ${platform} must carry an address`);
  }
  return trimmed;
}
