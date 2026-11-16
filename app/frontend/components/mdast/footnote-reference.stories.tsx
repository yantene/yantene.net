import { FootnoteReference } from "./footnote-reference";
import type { Meta, StoryObj } from "@storybook/react-vite";

/*
 * 脚注の参照。**持ち主 (PreviewLayer) が居ないここでは、今までと同じリンクになる。**
 * JavaScript が動かないときに読み手が見る姿でもある。
 *
 * チップとドロワーの出方は Preview/PreviewLayer で確かめる。
 */
const meta: Meta<typeof FootnoteReference> = {
  title: "Mdast/FootnoteReference",
  component: FootnoteReference,
  decorators: [
    (Story) => (
      <div className="p-6">
        <div className="mdast-prose prose max-w-3xl">
          <p>
            本文の途中で注を付ける
            <sup>
              <Story />
            </sup>
            。
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
    href: "#user-content-fn-1",
    id: "user-content-fnref-1",
    className: "press-control",
    children: "1",
  },
};
