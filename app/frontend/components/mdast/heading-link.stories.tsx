import { HeadingLink } from "./heading-link";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof HeadingLink> = {
  title: "Mdast/HeadingLink",
  component: HeadingLink,
  args: { anchor: "section" },
  decorators: [
    /*
     * 本文の見出しの頭に置かれる前提の大きさと色なので、見出しの中に入れて見る。
     * 溝へのぶら下げは mdast-prose 側の指定が持っている。
     */
    (Story) => (
      <div className="mdast-prose prose max-w-none bg-base-100 p-6">
        <h2 id="section">
          <Story />
          「よく読まれている」を、どう決めるか
        </h2>
        <p>本文。アイコンは見出しの左の溝にぶら下がり、字の左端は 1 行目も 2 行目も揃う。</p>
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
