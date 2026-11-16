import { ArticleLink } from "./article-link";
import type { Meta, StoryObj } from "@storybook/react-vite";

/*
 * このサイトの記事へのリンク。**持ち主 (PreviewLayer) が居ないここでは、素のリンクに
 * なる。** タッチの読み手と、JavaScript が動かないときに読み手が見る姿でもある。
 *
 * チップの出方は Preview/PreviewLayer で確かめる。
 */
const meta: Meta<typeof ArticleLink> = {
  title: "Mdast/ArticleLink",
  component: ArticleLink,
  decorators: [
    (Story) => (
      <div className="p-6">
        <div className="mdast-prose prose max-w-3xl">
          <p>
            別の記事への
            <Story />
            を本文に置く。
          </p>
        </div>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    href: "/articles/hello",
    slug: "hello",
    className: "press-control",
    children: "内部リンク",
  },
};
