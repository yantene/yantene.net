import { TagIndex } from "./tag-index";
import type { Meta, StoryObj } from "@storybook/react-vite";

// 実データの分布に合わせてある (記事数の多い順)。
const tags = [
  { tag: "日記", count: 14 },
  { tag: "競技プログラミング", count: 12 },
  { tag: "GNU/Linux", count: 7 },
  { tag: "プログラミング", count: 7 },
  { tag: "備忘録", count: 6 },
  { tag: "参加記", count: 3 },
  { tag: "試験", count: 3 },
  { tag: "Web", count: 2 },
  { tag: "アルゴリズム", count: 1 },
  { tag: "電子工作", count: 1 },
];

const meta: Meta<typeof TagIndex> = {
  title: "TagIndex/TagIndex",
  component: TagIndex,
  args: { tags, selected: null },
  decorators: [
    // 検索欄の下に添える幅で見る。
    (Story) => (
      <div className="w-full max-w-xl px-6">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 絞り込み中。選んでいるタグをもう一度押すと外れる。 */
export const Selected: Story = {
  args: { selected: "GNU/Linux" },
};

/** 検索語と併用しているとき。タグを押しても検索語は外れない。 */
export const WithQuery: Story = {
  args: { selected: "Web", query: "Linux" },
};

/** タグが 1 つだけのとき。 */
export const SingleTag: Story = {
  args: { tags: tags.slice(0, 1) },
};

/** 長いタグ名が混ざると折り返る。 */
export const LongNames: Story = {
  args: {
    tags: [{ tag: "とても長い名前のタグがあるとどう折り返るか", count: 3 }, ...tags.slice(0, 5)],
  },
};
