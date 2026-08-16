import { CodeBlock } from "./code-block";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof CodeBlock> = {
  title: "Mdast/CodeBlock",
  component: CodeBlock,
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

export const Default: Story = {
  args: {
    children: (
      <code>{`function greet(name: string): string {\n  return \`hello, \${name}\`;\n}`}</code>
    ),
  },
};

/** 横に長い行。器の中で横スクロールする。 */
export const Wide: Story = {
  args: {
    children: (
      <code>
        {`const veryLongVariableName = someFunction(firstArgument, secondArgument, thirdArgument, fourthArgument);`}
      </code>
    ),
  },
};

/** 縦に長い中身。コピーボタンは右上に留まる。 */
export const Tall: Story = {
  args: {
    children: (
      <code>
        {Array.from({ length: 20 }, (_, i) => `line ${String(i + 1)}`).join(
          "\n",
        )}
      </code>
    ),
  },
};
