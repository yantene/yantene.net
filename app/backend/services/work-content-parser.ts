import type { Root } from "mdast";
import { MathSyntaxError } from "./latex-to-mathml";
import { parseMarkdownBody } from "./markdown-body";
import { WorkName, WorkSummary, WorkUrl } from "~/backend/domain/work";

/**
 * 作品のコンテンツが読めなかった。
 *
 * 呼び出し側 (refresh) がファイル単位のコンテンツ不正として拾えるよう、infra 障害と
 * 区別できる型にしておく。**1 つでも読めなければファイルごと諦める。** 読めた欄だけを
 * 拾うと、書き手には直したつもりの誤りが残り続け、画面には歯抜けの作品が出る。
 */
export class WorkContentError extends Error {
  readonly name = "WorkContentError";
}

export interface ParsedWorkContent {
  readonly name: WorkName;
  readonly summary: WorkSummary;
  /** 作品そのものの在り処。書いていなければ undefined。 */
  readonly url: WorkUrl | undefined;
  /** 並び順。小さいほうが先。 */
  readonly position: number;
  /** フロントマターを除いた、詳しい説明の MDAST。 */
  readonly mdast: Root;
}

/**
 * 作品の Markdown を解析する。
 *
 * 読めない値はすべて {@link WorkContentError} に包んで送出する。読めない LaTeX
 * (MathSyntaxError) も同じ扱い。それ以外の失敗はパーサの不具合なので握りつぶさない。
 *
 * **公開範囲の欄は読まない。** 作品は書き手が手で選んで置くもので、出したくないものは
 * push しなければよい (ADR 0042)。
 */
export function parseWorkContent(markdown: string): ParsedWorkContent {
  let parsed;
  try {
    parsed = parseMarkdownBody(markdown);
  } catch (error) {
    if (error instanceof MathSyntaxError) throw new WorkContentError(error.message);
    throw error;
  }

  const frontmatter = parsed.frontmatter;
  try {
    return {
      name: WorkName.create(requireString(frontmatter.name, "name")),
      summary: WorkSummary.create(requireString(frontmatter.summary, "summary")),
      url: readUrl(frontmatter.url),
      position: requirePosition(frontmatter.position),
      mdast: parsed.mdast,
    };
  } catch (error) {
    if (error instanceof WorkContentError) throw error;
    // VO の検証はここで包む。パーサの不具合は上の catch と同じく素通しにしたいが、
    // VO は投げる型が集約ごとに違うので区別できない。書かれた値に起因する失敗しか
    // ここを通らないよう、VO の factory は値の検証だけを行う。
    throw new WorkContentError(error instanceof Error ? error.message : String(error));
  }
}

function readUrl(value: unknown): WorkUrl | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new WorkContentError(`frontmatter has unreadable url: ${JSON.stringify(value)}`);
  }
  return value.trim().length === 0 ? undefined : WorkUrl.create(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new WorkContentError(`frontmatter is missing ${field}`);
  }
  return value;
}

/**
 * 並び順。**省略できない。**
 *
 * 既定値を置くと、書き忘れた作品がどこに挟まるかを書き手が決められなくなる。
 * 数件しか無いものなので、必ず書かせるほうが迷いが無い。
 */
function requirePosition(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new WorkContentError(
      `frontmatter is missing a non-negative integer position: ${JSON.stringify(value)}`,
    );
  }
  return value;
}
