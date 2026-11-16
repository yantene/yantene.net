import type { Root } from "mdast";
import { Temporal } from "@js-temporal/polyfill";
import { asDateString, extractSummary } from "./article-content-parser";
import { MathSyntaxError } from "./latex-to-mathml";
import { parseMarkdownBody } from "./markdown-body";
import { SlideEvent, SlideTitle } from "~/backend/domain/slide";
import { paginate } from "~/lib/slides/deck";

/**
 * スライドのコンテンツが読めなかった。
 *
 * 呼び出し側 (refresh) がファイル単位のコンテンツ不正として拾えるよう、infra 障害と
 * 区別できる型にしておく。**1 つでも読めなければファイルごと諦める。** 読めた欄だけを
 * 拾うと、書き手には直したつもりの誤りが残り続ける (作品と同じ決め)。
 */
export class SlideContentError extends Error {
  readonly name = "SlideContentError";
}

export interface ParsedSlideContent {
  readonly title: SlideTitle;
  readonly publishedOn: Temporal.PlainDate;
  /** 発表の場。書いていなければ undefined。 */
  readonly event: SlideEvent | undefined;
  /** フロントマターを除いた本文の MDAST。 */
  readonly mdast: Root;
}

/**
 * スライドの Markdown を解析する。
 *
 * 読めない値はすべて {@link SlideContentError} に包んで送出する。読めない LaTeX
 * (MathSyntaxError) も同じ扱い。それ以外の失敗はパーサの不具合なので握りつぶさない。
 *
 * **公開範囲の欄は読まない。** 出したくないものは push しなければよい (作品と同じ)。
 * `status` や `visibility` が書いてあっても無視する。
 */
export function parseSlideContent(markdown: string): ParsedSlideContent {
  let parsed;
  try {
    parsed = parseMarkdownBody(markdown);
  } catch (error) {
    if (error instanceof MathSyntaxError) throw new SlideContentError(error.message);
    throw error;
  }

  const frontmatter = parsed.frontmatter;
  try {
    return {
      title: SlideTitle.create(requireString(frontmatter.title, "title")),
      publishedOn: requireDate(frontmatter.publishedOn, "publishedOn"),
      event: readEvent(frontmatter.event),
      mdast: parsed.mdast,
    };
  } catch (error) {
    if (error instanceof SlideContentError) throw error;
    // VO の検証はここで包む。書かれた値に起因する失敗しかここを通らないよう、
    // VO の factory は値の検証だけを行う (work-content-parser.ts と同じ)。
    throw new SlideContentError(error instanceof Error ? error.message : String(error));
  }
}

/**
 * 語り (地の文) の書き出しから要約を作る。
 *
 * **記事の要約の抽出を、語りだけに当てる。** 本文まるごとに当てると、箇条書きや図の alt や
 * 「間」の印 (`. . .`) が要約に混ざる。スライドに出る字は断片で、文として読めるのは
 * 語りのほう。どれが語りかはページの切り方 (`paginate`) が決めているので、ここで判定を
 * 持たない。語りを書いていないスライドでは空になる。
 */
export function summarizeNarration(mdast: Root): string {
  const narration = paginate(mdast).pages.flatMap((page) => ("notes" in page ? page.notes : []));
  return extractSummary({ type: "root", children: narration });
}

function isAbsent(value: unknown): value is undefined | null {
  return value === undefined || value === null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unreadable(field: string, value: unknown): SlideContentError {
  return new SlideContentError(`frontmatter has unreadable ${field}: ${JSON.stringify(value)}`);
}

/**
 * 題は省略できない。**スラグで代用しない。** 題は表紙にいちばん大きく出る字で、
 * 書き忘れたスライドの表紙に `lt-2026` と出るより、同期されないほうが気づける。
 */
function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new SlideContentError(`frontmatter is missing ${field}`);
  }
  return value;
}

/** `YYYY-MM-DD`。読み方は記事の `publishedOn` と同じ (YAML が Date で返す場合にも備える)。 */
function readDate(value: unknown, field: string): Temporal.PlainDate {
  const text = asDateString(value);
  if (text === undefined) throw unreadable(field, value);
  try {
    return Temporal.PlainDate.from(text);
  } catch {
    throw unreadable(field, value);
  }
}

function requireDate(value: unknown, field: string): Temporal.PlainDate {
  if (isAbsent(value)) throw new SlideContentError(`frontmatter is missing ${field}`);
  return readDate(value, field);
}

/**
 * 発表の場。**書くなら名前は省略できない。** 日付と URL は「どの場の」が決まって初めて
 * 意味を持つので、名前の無い `event` はスライドごと諦める。
 */
function readEvent(value: unknown): SlideEvent | undefined {
  if (isAbsent(value)) return undefined;
  if (!isRecord(value)) throw unreadable("event", value);
  if (typeof value.name !== "string" || value.name.trim().length === 0) {
    throw new SlideContentError("frontmatter is missing event.name");
  }
  return SlideEvent.create({
    name: value.name,
    ...(isAbsent(value.date) ? {} : { date: readDate(value.date, "event.date") }),
    ...optionalUrl(value.url),
  });
}

function optionalUrl(value: unknown): { url?: string } {
  if (isAbsent(value)) return {};
  if (typeof value !== "string") throw unreadable("event.url", value);
  return value.trim().length === 0 ? {} : { url: value };
}
