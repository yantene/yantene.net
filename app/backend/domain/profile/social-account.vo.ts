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
      url: validateUrl(params.url),
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
 * 出ていく先なので絶対 URL。スキームは http(s) だけ通す。
 *
 * `javascript:` を弾くのが目的。コンテンツリポジトリに書けるのは書き手だけだが、打ち間違いが
 * そのまま href に乗る経路をドメインの外に作らない。
 */
function validateUrl(raw: string): string {
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
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new InvalidSocialUrlError(`Social URL must be http(s), got ${parsed.protocol}`);
  }
  return trimmed;
}
