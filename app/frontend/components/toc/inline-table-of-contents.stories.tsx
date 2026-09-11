import { InlineTableOfContents } from "./inline-table-of-contents";
import { TocHeadingsContext } from "./toc-context";
import type { TocHeading } from "~/backend/handlers/articles/toc-headings";
import type { Meta, StoryObj } from "@storybook/react-vite";

const headings: TocHeading[] = [
  { id: "intro", text: "はじめに", level: 2 },
  { id: "why", text: "なぜ自作するか", level: 2 },
  { id: "why-detail", text: "既存サービスとの比較", level: 3 },
  { id: "design", text: "設計の方針", level: 2 },
  { id: "closing", text: "おわりに", level: 2 },
];

const meta: Meta<typeof InlineTableOfContents> = {
  title: "Article/InlineTableOfContents",
  component: InlineTableOfContents,
  decorators: [
    (Story) => (
      <div className="mdast-prose max-w-2xl bg-base-100 p-6">
        <p>リード文。目次はこの下、最初の h2 の直前に差し込まれる。</p>
        <Story />
        <h2>はじめに</h2>
        <p>本編。</p>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** 畳まずに置く。読み始める前に構造が見えることが目的なので、開く手間を挟まない。 */
export const Default: Story = {
  decorators: [
    (Story) => (
      <TocHeadingsContext value={headings}>
        <Story />
      </TocHeadingsContext>
    ),
  ],
};

/**
 * 節が 1 つしかない記事では描かない。h3 がいくつあっても同じで、1 項目の目次は
 * 押せる場所が増えるだけで全体像を伝えない。
 */
export const SingleSection: Story = {
  decorators: [
    (Story) => (
      <TocHeadingsContext
        value={headings.filter((heading) => heading.level === 3 || heading.id === "intro")}
      >
        <Story />
      </TocHeadingsContext>
    ),
  ],
};

/** 見出しが無ければ何も描かない。 */
export const Empty: Story = {
  decorators: [
    (Story) => (
      <TocHeadingsContext value={[]}>
        <Story />
      </TocHeadingsContext>
    ),
  ],
};
