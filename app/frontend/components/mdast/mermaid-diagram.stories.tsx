import { MermaidDiagram } from "./mermaid-diagram";
import type { Meta, StoryObj } from "@storybook/react-vite";

/*
 * 組み上がるまでと、組めなかったときに出るもの。本番では mdast-renderer が包んだ
 * 元のコードブロックがここに来るので、ストーリーでも同じ形のものを渡す。
 */
function SourceBlock({
  source,
}: {
  readonly source: string;
}): React.JSX.Element {
  return (
    <div className="code-block">
      <pre>
        <code className="language-mermaid">{source}</code>
      </pre>
    </div>
  );
}

const flowchart = `flowchart LR
  A[Markdown] --> B[MDAST]
  B --> C{mermaid?}
  C -- はい --> D[ブラウザで SVG に組む]
  C -- いいえ --> E[コードブロックのまま]`;

const sequence = `sequenceDiagram
  participant 読者
  participant Worker
  participant R2
  読者->>Worker: GET /notes/foo
  Worker->>R2: MDAST を読む
  R2-->>Worker: MDAST
  Worker-->>読者: SSR した HTML`;

const broken = `flowchart LR
  A --> ((((`;

const meta: Meta<typeof MermaidDiagram> = {
  title: "Mdast/MermaidDiagram",
  component: MermaidDiagram,
  parameters: { layout: "padded" },
  // 図の余白と溢れの扱いは本文 (note-prose) の中でしか当たらない。
  decorators: [
    (Story) => (
      <div className="note-prose prose max-w-none">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Flowchart: Story = {
  args: {
    source: flowchart,
    children: <SourceBlock source={flowchart} />,
  },
};

export const Sequence: Story = {
  args: {
    source: sequence,
    children: <SourceBlock source={sequence} />,
  },
};

/*
 * 構文が読めないとき。図は出ず、書いたソースがコードブロックとして残る。
 * 記事の他の部分は巻き添えにしない。
 */
export const BrokenSource: Story = {
  args: {
    source: broken,
    children: <SourceBlock source={broken} />,
  },
};
