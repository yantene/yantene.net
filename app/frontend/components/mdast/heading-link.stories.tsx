import { HeadingLink } from "./heading-link";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof HeadingLink> = {
  title: "Mdast/HeadingLink",
  component: HeadingLink,
  args: { anchor: "section" },
  decorators: [
    /*
     * 本文の見出しの末尾に置かれる前提の大きさと色なので、見出しの中に入れて見る。
     * 末尾に置くのは、頭だと見出しの字が本文より右へずれるため。
     */
    (Story) => (
      <div className="mdast-prose prose max-w-none bg-base-100 p-6">
        <h2 id="section">
          「よく読まれている」を、どう決めるか
          <Story />
        </h2>
        <p>本文。見出しの字は 1 行目も折り返した行も、この本文と同じ位置から始まる。</p>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** 既定。薄く置き、hover で色が寄る。 */
export const Default: Story = {};

/** 行き先が無ければ何も描かない。 */
export const WithoutAnchor: Story = { args: { anchor: undefined } };
