import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RelatedArticlesCard } from "./related-articles-card";
import { withI18n } from "~/frontend/lib/test-render";

const renderWithI18n = withI18n();

const article = {
  slug: "logic-gates",
  title: "論理ゲートをトランジスタで実装する",
  imageUrl: null,
  publishedOn: "2026-08-20",
  language: "ja",
};

describe("RelatedArticlesCard", () => {
  it("関連記事を題のリンクとして並べる", () => {
    renderWithI18n(<RelatedArticlesCard title="Related articles" articles={[article]} />);

    expect(screen.getByRole("region", { name: "Related articles" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /論理ゲート/ })).toHaveAttribute(
      "href",
      "/articles/logic-gates",
    );
  });

  it("絵は飾りなので読み上げに渡さない", () => {
    const { container } = renderWithI18n(
      <RelatedArticlesCard
        title="Related articles"
        articles={[{ ...article, imageUrl: "/api/v1/articles/logic-gates/assets/cover.png" }]}
      />,
    );

    expect(container.querySelector("img")).toHaveAttribute("alt", "");
  });

  it("関連記事が無ければ何も描かない", () => {
    const { container } = renderWithI18n(
      <RelatedArticlesCard title="Related articles" articles={[]} />,
    );

    expect(container.querySelector("section")).toBeNull();
  });
});
