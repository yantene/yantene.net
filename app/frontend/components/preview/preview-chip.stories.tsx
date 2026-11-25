import { ArticlePreviewCard } from "./article-preview-card";
import { PreviewChip } from "./preview-chip";
import type { Meta, StoryObj } from "@storybook/react-vite";

/*
 * チップの器。描かれた時点で Popover API が最前面に開く。
 *
 * **ここでは錨になるリンクが居ない。** 位置合わせ (CSS anchor positioning) の様子は
 * Preview/PreviewLayer で、実際にリンクへ乗せて確かめる。ここで見るのは器の見た目
 * (縁・影・余白) と、長い中身が中で巻くこと。
 */
const meta: Meta<typeof PreviewChip> = {
  title: "Preview/PreviewChip",
  component: PreviewChip,
  args: { id: "preview-chip" },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** 内部リンクのチップ。 */
export const Article: Story = {
  args: {
    children: (
      <ArticlePreviewCard
        preview={{
          slug: "hello",
          title: "記事の題",
          summary: "記事の要約。一覧に出るものと同じ文が入る。",
          publishedOn: "2026-11-16",
          imageUrl: null,
          language: "ja",
        }}
      />
    ),
  },
};

/** 脚注のチップ。本文と同じ組版に乗る。 */
export const Footnote: Story = {
  args: {
    children: (
      <div className="preview-footnote mdast-prose prose max-w-none">
        <p>
          脚注の中身。<strong>装飾</strong>も<a href="https://example.com">リンク</a>も、
          本文と同じ描き方で出る。
        </p>
      </div>
    ),
  },
};

/** 長い中身。器の高さには上限があり、中で巻く。 */
export const Long: Story = {
  args: {
    children: (
      <div className="preview-footnote mdast-prose prose max-w-none">
        {Array.from({ length: 12 }, (_, index) => (
          <p key={index}>長い脚注の {index + 1} 段落目。チップは伸び続けず、中で巻く。</p>
        ))}
      </div>
    ),
  },
};
