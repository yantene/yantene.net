import { ArticleTimelineItem } from "./article-timeline-item";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof ArticleTimelineItem> = {
  title: "ArticleTimeline/ArticleTimelineItem",
  component: ArticleTimelineItem,
  args: {
    slug: "hello-world",
    title: "はじめての記事",
    summary: "これは記事の要約です。一覧やホームの新着に、先頭 160 文字ほどが表示されます。",
    imageUrl: "https://picsum.photos/seed/yantene/640/400",
    publishedOn: "2026-05-08",
  },
  decorators: [
    // 単体でも縦線とドットの位置関係が見えるよう、リストの文脈を与える。
    (Story) => (
      <ol className="article-timeline w-full max-w-3xl px-6">
        <Story />
      </ol>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithoutImage: Story = {
  args: { imageUrl: null },
};

/** 長いタイトルと要約。要約は 2 行で打ち切る。 */
export const LongText: Story = {
  args: {
    title:
      "Cloudflare Workers と Hono と React Router v7 で個人サイトを組み直したときに考えていたこと",
    summary:
      "ページ描画を React Router に任せる分担、MDAST をそのまま返す API、コンテンツの正本を git リポジトリに置く構成まで、一年ぶんの設計判断をまとめて振り返る。",
  },
};
