import type { SocialAccount } from "~/backend/domain/profile";
import type { Root } from "mdast";
import { MathSyntaxError } from "./latex-to-mathml";
import { parseMarkdownBody } from "./markdown-body";
import { ProfileName, SocialAccount as SocialAccountVo, Tagline } from "~/backend/domain/profile";

/**
 * プロフィールのコンテンツが読めなかった。
 *
 * 呼び出し側 (refresh) がファイル単位のコンテンツ不正として拾えるよう、infra 障害と
 * 区別できる型にしておく。**1 行でも読めなければファイルごと諦める。** 読めた行だけを
 * 拾うと、書き手には直したつもりの誤りが残り続け、画面には歯抜けのプロフィールが出る。
 */
export class ProfileContentError extends Error {
  readonly name = "ProfileContentError";
}

export interface ParsedProfileContent {
  readonly name: ProfileName;
  readonly tagline: Tagline;
  /**
   * フロントマターに書かれた顔写真のパス。
   *
   * 解決は呼び出し側の役目。アセットがどの URL で配られるかを知っているのは、
   * コンテンツリポジトリの並びを見ている側なので。
   */
  readonly avatar: string | undefined;
  readonly socials: readonly SocialAccount[];
  /** フロントマターを除いた長い自己紹介の MDAST。 */
  readonly mdast: Root;
}

/**
 * プロフィールの Markdown を解析する。
 *
 * 読めない値はすべて {@link ProfileContentError} に包んで送出する。読めない LaTeX
 * (MathSyntaxError) も同じ扱い。それ以外の失敗はパーサの不具合なので握りつぶさない。
 */
export function parseProfileContent(markdown: string): ParsedProfileContent {
  let parsed;
  try {
    parsed = parseMarkdownBody(markdown);
  } catch (error) {
    if (error instanceof MathSyntaxError) throw new ProfileContentError(error.message);
    throw error;
  }

  const frontmatter = parsed.frontmatter;
  try {
    return {
      name: ProfileName.create(requireString(frontmatter.name, "name")),
      tagline: Tagline.create(requireString(frontmatter.tagline, "tagline")),
      avatar: optionalString(frontmatter.avatar, "avatar"),
      socials: readSocials(frontmatter.socials),
      mdast: parsed.mdast,
    };
  } catch (error) {
    if (error instanceof ProfileContentError) throw error;
    // VO の検証 (名前・出ていく先・日付) はここで包む。パーサの不具合は上の catch と
    // 同じく素通しにしたいが、VO は投げる型が集約ごとに違うので区別できない。
    // 書かれた値に起因する失敗しかここを通らないよう、VO の factory は値の検証だけを行う。
    throw new ProfileContentError(error instanceof Error ? error.message : String(error));
  }
}

function readSocials(value: unknown): readonly SocialAccount[] {
  if (value === undefined || value === null) return [];
  return asArray(value, "socials").map((entry, index) => {
    const record = asRecord(entry, `socials[${String(index)}]`);
    return SocialAccountVo.create({
      platform: requireString(record.platform, `socials[${String(index)}].platform`),
      url: requireString(record.url, `socials[${String(index)}].url`),
      isMe: asBoolean(record.isMe, `socials[${String(index)}].isMe`),
    });
  });
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ProfileContentError(`frontmatter is missing ${field}`);
  }
  return value;
}

function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new ProfileContentError(`frontmatter has unreadable ${field}: ${JSON.stringify(value)}`);
  }
  return value.trim().length === 0 ? undefined : value;
}

function asArray(value: unknown, field: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new ProfileContentError(`frontmatter has unreadable ${field}: expected a list`);
  }
  return value as readonly unknown[];
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ProfileContentError(`frontmatter has unreadable ${field}: expected a mapping`);
  }
  return value as Record<string, unknown>;
}

/** 書いていなければ false。真偽値として読めない値は誤りとして報告する。 */
function asBoolean(value: unknown, field: string): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value !== "boolean") {
    throw new ProfileContentError(`frontmatter has unreadable ${field}: ${JSON.stringify(value)}`);
  }
  return value;
}
