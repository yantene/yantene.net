import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ArticleHeader } from "./article-header";
import { withI18n } from "~/frontend/lib/test-render";

// withI18n は beforeAll で i18n を組むので、describe の外で呼んでおく。
const renderJa = withI18n("ja");
const renderEn = withI18n("en");

const props = {
  slug: "hello-world",
  title: "はじめての記事",
  imageUrl: null,
  publishedOn: "2026-05-08",
  language: "ja",
  origin: "https://yantene.net",
  realName: "吉田 周平",
  readingMinutes: 8,
  actions: null,
} as const;

/*
 * 筆者は「サイトの名前 (本名)」で名乗る。サイトの名前も本名も画面の言語に従う。
 */
describe("ArticleHeader の名乗りの行", () => {
  it("日本語の画面では「やんてね (本名)」", () => {
    renderJa(<ArticleHeader {...props} realNameEn="Shuhei YOSHIDA" />);

    expect(screen.getByRole("link", { name: "やんてね (吉田 周平)" })).toHaveAttribute(
      "href",
      "/about",
    );
    expect(screen.getByText("約 8 分で読めます")).toBeInTheDocument();
  });

  it("英語の画面では「yantene (英語名)」", () => {
    renderEn(<ArticleHeader {...props} realNameEn="Shuhei YOSHIDA" />);

    expect(screen.getByRole("link", { name: "yantene (Shuhei YOSHIDA)" })).toBeInTheDocument();
    expect(screen.getByText("8 min read")).toBeInTheDocument();
  });

  it("英語名が無ければ、英語の画面でも本名のまま", () => {
    renderEn(<ArticleHeader {...props} realNameEn={null} />);

    expect(screen.getByRole("link", { name: "yantene (吉田 周平)" })).toBeInTheDocument();
  });
});
