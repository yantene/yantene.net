import type { Root } from "mdast";
import { MathSyntaxError } from "./latex-to-mathml";
import { parseMarkdownBody } from "./markdown-body";
import { ArticleSlug } from "~/backend/domain/article";
import { HistoryDate } from "~/backend/domain/profile";
import {
  isWorkScreenshotKind,
  WorkName,
  WorkPeriod,
  WorkRole,
  WorkScreenshot,
  WorkStack,
  WorkSummary,
  WorkUrl,
} from "~/backend/domain/work";

/*
 * 1 作品に書ける数の上限。
 *
 * 見た目の都合ではなく **D1 の都合**で切ってある。関連記事は描画のたびに slug を
 * `IN (...)` に並べて引くので、バインドパラメータ上限 (100) を超える数を書かれると
 * 作品のページが 500 になる。しかも手元 (node:sqlite) では踏めない。
 */
const MAX_SCREENSHOTS = 12;
const MAX_ARTICLES = 30;

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
  /** `/works` で大きく出すかどうか。書いていなければ false。 */
  readonly featured: boolean;
  /** 使った技術の名前の並び。書いていなければ空。 */
  readonly stack: WorkStack;
  /** 作った時期。書いていなければ undefined。 */
  readonly period: WorkPeriod | undefined;
  /** 自分の役割。書いていなければ undefined。 */
  readonly role: WorkRole | undefined;
  /**
   * スクリーンショット。**`src` は書かれたまま** (作品の置き場からの相対パス)。
   * 配る URL への解決と、置き場に実在するかの確かめは同期の側が行う。
   */
  readonly screenshots: readonly WorkScreenshot[];
  /**
   * この作品について書いた記事の slug。**実在するかは見ていない。** 記事として
   * 読める字であることだけを確かめてある。
   */
  readonly articleSlugs: readonly ArticleSlug[];
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
      featured: readFeatured(frontmatter.featured),
      stack: readStack(frontmatter.stack),
      period: readPeriod(frontmatter.period),
      role: readRole(frontmatter.role),
      screenshots: readScreenshots(frontmatter.screenshots),
      articleSlugs: readArticleSlugs(frontmatter.articles),
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

function isAbsent(value: unknown): value is undefined | null {
  return value === undefined || value === null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unreadable(field: string, value: unknown): WorkContentError {
  return new WorkContentError(`frontmatter has unreadable ${field}: ${JSON.stringify(value)}`);
}

/**
 * **真偽値だけ。** `yes` や `"true"` は通さない (YAML 1.2 では文字列として届く)。
 * 「たぶん真」を拾い始めると、`featured: no` を真として拾う誤りの入口になる。
 */
function readFeatured(value: unknown): boolean {
  if (isAbsent(value)) return false;
  if (typeof value !== "boolean") throw unreadable("featured", value);
  return value;
}

function readStack(value: unknown): WorkStack {
  if (isAbsent(value)) return WorkStack.empty();
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    throw unreadable("stack", value);
  }
  return WorkStack.create(value);
}

/** `from` は省略できない。終わりだけの期間は書けない (経歴の `until` と同じ決まり)。 */
function readPeriod(value: unknown): WorkPeriod | undefined {
  if (isAbsent(value)) return undefined;
  if (!isRecord(value) || isAbsent(value.from)) throw unreadable("period", value);
  return WorkPeriod.create({
    from: HistoryDate.create(value.from),
    ...(isAbsent(value.until) ? {} : { until: HistoryDate.create(value.until) }),
  });
}

function readRole(value: unknown): WorkRole | undefined {
  if (isAbsent(value)) return undefined;
  if (typeof value !== "string") throw unreadable("role", value);
  return value.trim().length === 0 ? undefined : WorkRole.create(value);
}

function readScreenshots(value: unknown): readonly WorkScreenshot[] {
  if (isAbsent(value)) return [];
  if (!Array.isArray(value)) throw unreadable("screenshots", value);
  if (value.length > MAX_SCREENSHOTS) {
    throw new WorkContentError(
      `frontmatter has too many screenshots: ${String(value.length)} (at most ${String(MAX_SCREENSHOTS)})`,
    );
  }
  const screenshots = value.map((item, index) => readScreenshot(item, index));
  const sources = screenshots.map((screenshot) => screenshot.src);
  if (new Set(sources).size !== sources.length) {
    throw new WorkContentError("frontmatter lists the same screenshot src twice");
  }
  return screenshots;
}

/**
 * **`alt` が無ければ作品ごと諦める。** スクリーンショットは「どんなものか」を伝える
 * 中身で、字の無い 1 枚を黙って出すと、画像を見ない読み手には何も届かない。
 */
function readScreenshot(value: unknown, index: number): WorkScreenshot {
  const field = `screenshots[${String(index)}]`;
  if (!isRecord(value)) throw unreadable(field, value);
  if (typeof value.src !== "string" || value.src.trim().length === 0) {
    throw new WorkContentError(`frontmatter is missing ${field}.src`);
  }
  if (typeof value.alt !== "string" || value.alt.trim().length === 0) {
    throw new WorkContentError(`frontmatter is missing ${field}.alt`);
  }
  if (!isAbsent(value.kind) && !isWorkScreenshotKind(value.kind)) {
    throw unreadable(`${field}.kind`, value.kind);
  }
  return WorkScreenshot.create({
    src: value.src,
    alt: value.alt,
    ...(isAbsent(value.kind) ? {} : { kind: value.kind }),
  });
}

/**
 * 関連記事の slug。
 *
 * **実在しない slug は通す。** 作品と記事のどちらが先に同期されるかに引きずられない
 * ためで、無い記事は出すときに外れ、同期の結果に警告として出る。
 *
 * **slug として読めない字は弾く。** `Why I Built It` のような字は、この先どの記事を
 * 書いても一致しない。警告で済ませると、直らない誤りが警告として出続ける。
 */
function readArticleSlugs(value: unknown): readonly ArticleSlug[] {
  if (isAbsent(value)) return [];
  if (!Array.isArray(value)) throw unreadable("articles", value);
  if (value.length > MAX_ARTICLES) {
    throw new WorkContentError(
      `frontmatter has too many articles: ${String(value.length)} (at most ${String(MAX_ARTICLES)})`,
    );
  }
  const slugs = value.map((item) => readArticleSlug(item));
  if (new Set(slugs.map((slug) => slug.toString())).size !== slugs.length) {
    throw new WorkContentError("frontmatter lists the same article twice");
  }
  return slugs;
}

function readArticleSlug(value: unknown): ArticleSlug {
  const slug = typeof value === "string" ? ArticleSlug.parse(value) : undefined;
  if (slug === undefined) throw unreadable("articles entry", value);
  return slug;
}
