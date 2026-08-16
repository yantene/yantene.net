import { EmbedFrame } from "./embed-frame";
import type { Meta, StoryObj } from "@storybook/react-vite";

/*
 * 幅に追随する枠に埋め込みを収める。src の相手を絞るのは mdast-renderer.tsx の
 * toEmbed の仕事で、ここは形だけを持つ。
 */
const meta: Meta<typeof EmbedFrame> = {
  title: "Mdast/EmbedFrame",
  component: EmbedFrame,
  args: {
    src: "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    title: "埋め込み動画",
  },
  /*
   * 本文の中に出るものなので、prose の中で確かめる。幅は記事ページの本文と同じ 768px
   * (max-w-3xl)。**余白は外側に持たせる。** prose 自身に padding を置くと中身が 720px に
   * 痩せて、記事ページ (padding は外の行が持つ) と 48px ずれる (link-card.stories.tsx と同じ)。
   */
  decorators: [
    (Story) => (
      <div className="p-6">
        <div className="note-prose prose max-w-3xl">
          <Story />
        </div>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** title を渡さない場合。既定の「埋め込み動画」が入る。 */
export const WithoutTitle: Story = {
  args: { title: undefined },
};
