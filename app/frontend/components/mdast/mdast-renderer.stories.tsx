import { MdastRenderer } from "./mdast-renderer";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { Root as MdastRoot } from "mdast";
import { parseNoteContent } from "~/backend/services/note-content-parser";

/*
 * 本番と同じ経路で MDAST を組む。数式の MathML は refresh 時にここで埋まるので、
 * 素の remark で組むと数式だけがストーリーと本番で食い違う。
 */
function markdownToMdast(markdown: string): MdastRoot {
  return parseNoteContent(markdown).mdast;
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

/*
 * 数式。組版はブラウザの MathML に任せているので、見え方は環境の数式フォントに左右される
 * (Windows は Cambria Math が入っており概ね綺麗に出る。Linux は一部の記号が豆腐になる)。
 */
export const Formulas: Story = {
  args: {
    node: markdownToMdast(
      [
        "文中に $a^2 + b^2 = c^2$ と書くと、その場に組まれる。",
        "$$\n\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\n$$",
        "$$\n\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}\n$$",
        "$$\n\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}\n$$",
        "$$\n\\int_0^\\infty e^{-x^2}\\,dx = \\frac{\\sqrt{\\pi}}{2}\n$$",
        "$$\n\\text{速さ} = \\frac{\\text{距離}}{\\text{時間}}\n$$",
      ].join("\n\n"),
    ),
  },
};
