import { RelatedArticlesCard } from "./related-articles-card";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof RelatedArticlesCard> = {
  title: "RelatedArticles/RelatedArticlesCard",
  component: RelatedArticlesCard,
  args: {
    title: "Related articles",
    articles: [
      {
        slug: "transistor-basics",
        title: "トランジスタのしくみをおさらい",
        imageUrl: "https://picsum.photos/seed/transistor/200/200",
        publishedOn: "2026-08-12",
        language: "ja",
      },
      {
        slug: "logic-gates",
        title: "論理ゲートをトランジスタで実装する",
        imageUrl: null,
        publishedOn: "2026-08-20",
        language: "ja",
      },
      {
        slug: "latch-vs-flip-flop",
        title: "ラッチとフリップフロップの違いを、タイミング図を描きながら確かめていく長い題",
        imageUrl: "https://picsum.photos/seed/latch/200/200",
        publishedOn: "2026-08-25",
        language: "ja",
      },
    ],
  },
  decorators: [
    // 記事ページの右の列と同じ幅に置く。
    (Story) => (
      <div className="w-60">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
