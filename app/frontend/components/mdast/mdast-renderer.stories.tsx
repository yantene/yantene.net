import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { MdastRenderer } from "./mdast-renderer";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Root as MdastRoot } from "mdast";

function markdownToMdast(markdown: string): MdastRoot {
  return unified().use(remarkParse).use(remarkGfm).parse(markdown);
}

const sample = `# 見出し 1

これは **段落** です。_強調_ と \`インラインコード\` と
[内部リンク](/notes/other) と [外部リンク](https://example.com) を含みます。

## 見出し 2

- 箇条書き 1
- 箇条書き 2
  - ネスト

1. 順序 1
2. 順序 2

> 引用文。複数行にわたることもある。

\`\`\`ts
export function greet(name: string): string {
  return \`Hello, \${name}\`;
}
\`\`\`

| 左 | 中央 | 右 |
| :-- | :--: | --: |
| a | b | c |

![代替テキスト](./cover.png)

---

脚注つきの文章[^1]。

[^1]: これは脚注です。
`;

const meta: Meta<typeof MdastRenderer> = {
  title: "Mdast/MdastRenderer",
  component: MdastRenderer,
  parameters: { layout: "padded" },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    node: markdownToMdast(sample),
  },
};

export const WithImageResolution: Story = {
  args: {
    node: markdownToMdast("![cover](./cover.png)"),
    transformImageUrl: (src) =>
      src.replace(/^\.\//, "/api/v1/notes/example/assets/"),
  },
};

export const Headings: Story = {
  args: {
    node: markdownToMdast(
      ["# H1", "## H2", "### H3", "#### H4", "##### H5", "###### H6"].join(
        "\n\n",
      ),
    ),
  },
};
