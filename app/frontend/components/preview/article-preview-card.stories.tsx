import { ArticlePreviewCard } from "./article-preview-card";
import type { Meta, StoryObj } from "@storybook/react-vite";

/*
 * 内部リンクのチップの中身。器 (PreviewChip) の幅に合わせて、狭い箱の中で確かめる。
 */
const meta: Meta<typeof ArticlePreviewCard> = {
  title: "Preview/ArticlePreviewCard",
  component: ArticlePreviewCard,
  decorators: [
    (Story) => (
      <div className="max-w-sm p-6">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    preview: {
      slug: "hello",
      title: "記事の題",
      summary: "記事の要約。一覧に出るものと同じ文が入る。",
      publishedOn: "2026-11-16",
      imageUrl: null,
      language: "ja",
    },
  },
};

/** 要約は 3 行で切る。チップの大きさを記事ごとに揺らさない。 */
export const LongSummary: Story = {
  args: {
    preview: {
      slug: "long",
      title: "題が長くて折り返す記事。二行にわたっても、日付と要約との間合いは崩れない",
      summary:
        "要約は先頭 160 文字まで入る。チップにそのまま流すと高さが記事ごとに変わるので、3 行で切って揃える。続きは記事を開けば読める。ここから先は切られて見えないはずの文で、見えていたら行数の上限が効いていない。",
      publishedOn: "2026-01-05",
      imageUrl: null,
      language: "ja",
    },
  },
};

/** 要約の無い記事 (本文が見出しとコードだけ、など)。題と日付だけになる。 */
export const WithoutSummary: Story = {
  args: {
    preview: {
      slug: "bare",
      title: "要約の無い記事",
      summary: "",
      publishedOn: "2026-03-20",
      imageUrl: null,
      language: "ja",
    },
  },
};
