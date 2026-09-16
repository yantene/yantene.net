import type { HistoryEntry, SocialAccount } from "~/backend/domain/profile";
import type { Root } from "mdast";
import { MathSyntaxError } from "./latex-to-mathml";
import { parseMarkdownBody } from "./markdown-body";
import {
  HistoryEntry as HistoryEntryVo,
  ProfileName,
  SocialAccount as SocialAccountVo,
  Tagline,
} from "~/backend/domain/profile";

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
  readonly socials: readonly SocialAccount[];
  /** 経歴。章を各件が持つ平らな並びで、書いた順のまま。 */
  readonly history: readonly HistoryEntry[];
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
      socials: readSocials(frontmatter.socials),
      history: readHistory(frontmatter.history),
      mdast: parsed.mdast,
    };
  } catch (error) {
    if (error instanceof ProfileContentError) throw error;
    // VO の検証 (名前・出ていく先・経歴) はここで包む。パーサの不具合は上の catch と
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

/**
 * 経歴を読む。**章の入れ子を平らな並びに畳む。**
 *
 * 書く側は章ごとに束ねて書き (章の名前を 1 回で済ませたい)、保存する側は
 * `profile_socials` と同じ平らな行にしたい。そのずれをここで吸収して、各件に章の
 * 名前を写す。書いた順は崩さない (章の順も、章の中の順も、出す側がそのまま使う)。
 *
 * **空の章を通さない。** `entries` を書き忘れた章は、左の柱に名前だけが立って中身の
 * 無い束になる。書き忘れなので、その場で止めて理由を返す。
 */
function readHistory(value: unknown): readonly HistoryEntry[] {
  if (value === undefined || value === null) return [];
  return asArray(value, "history").flatMap((group, groupIndex) => {
    const label = `history[${String(groupIndex)}]`;
    const record = asRecord(group, label);
    const chapter = requireString(record.chapter, `${label}.chapter`);
    const entries = asArray(record.entries, `${label}.entries`);
    if (entries.length === 0) {
      throw new ProfileContentError(
        `frontmatter has unreadable ${label}.entries: expected 1 or more`,
      );
    }
    return entries.map((entry, entryIndex) => {
      const entryLabel = `${label}.entries[${String(entryIndex)}]`;
      const fields = asRecord(entry, entryLabel);
      const month = optionalNumber(fields.month, `${entryLabel}.month`);
      const url = optionalString(fields.url, `${entryLabel}.url`);
      const note = optionalString(fields.note, `${entryLabel}.note`);
      return HistoryEntryVo.create({
        chapter,
        year: asNumber(fields.year, `${entryLabel}.year`),
        ...(month === undefined ? {} : { month }),
        text: requireString(fields.text, `${entryLabel}.text`),
        ...(url === undefined ? {} : { url }),
        ...(note === undefined ? {} : { note }),
      });
    });
  });
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ProfileContentError(`frontmatter is missing ${field}`);
  }
  return value;
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

/**
 * 書いていなければ undefined。
 *
 * **空の値を「無い」と報告しない。** `requireString` に回すと `is missing <欄>` になり、
 * 書いてある欄を探しに行かせることになる。書いてあるが読めない、と言う。
 */
function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ProfileContentError(`frontmatter has unreadable ${field}: ${JSON.stringify(value)}`);
  }
  return value;
}

/** 書いていなければ undefined。数として読めない値は誤りとして報告する。 */
function optionalNumber(value: unknown, field: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  return asNumber(value, field);
}

/**
 * 数として読む。
 *
 * **文字列は通さない。** YAML は `year: 2012` を数、`year: "2012"` を文字列として
 * 渡してくる。書き手にとっては同じつもりの字なので、通すか通さないかを決めておかないと
 * 「引用符を付けた年だけ静かに落ちる」ことになる。通さない側に倒して理由を返す。
 */
function asNumber(value: unknown, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ProfileContentError(`frontmatter has unreadable ${field}: ${JSON.stringify(value)}`);
  }
  return value;
}

/** 書いていなければ false。真偽値として読めない値は誤りとして報告する。 */
function asBoolean(value: unknown, field: string): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value !== "boolean") {
    throw new ProfileContentError(`frontmatter has unreadable ${field}: ${JSON.stringify(value)}`);
  }
  return value;
}
