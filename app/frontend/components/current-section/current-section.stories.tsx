import { CurrentSection } from "./current-section";
import type { TocHeading } from "~/backend/handlers/articles/toc-headings";
import type { Meta, StoryObj } from "@storybook/react-vite";

const headings: TocHeading[] = [
  { id: "intro", text: "はじめに", level: 2 },
  { id: "why", text: "なぜ自作するか", level: 2 },
  { id: "why-detail", text: "既存サービスとの比較", level: 3 },
  { id: "design", text: "設計の方針", level: 2 },
  { id: "closing", text: "おわりに", level: 2 },
];

const meta: Meta<typeof CurrentSection> = {
  title: "Article/CurrentSection",
  component: CurrentSection,
  args: { headings },
  decorators: [
    /*
     * 帯は画面上端に固定で出て、本文の見出しを IntersectionObserver で見張る。地の見出しが
     * 無いと何も出ないので、id 付きの見出しを持つ本文を敷く。
     *
     * Storybook の枠は狭いので、既定で携帯幅の条件を満たす。
     */
    (Story) => (
      <div className="bg-base-100 p-6">
        <Story />
        <article className="mdast-prose">
          <h2 id="intro">はじめに</h2>
          <p className="h-[60vh]">本文。</p>
          <h2 id="why">なぜ自作するか</h2>
          <h3 id="why-detail">既存サービスとの比較</h3>
          <p className="h-[60vh]">本文。</p>
          <h2 id="design">設計の方針</h2>
          <p className="h-[60vh]">本文。</p>
          <h2 id="closing">おわりに</h2>
          <p className="h-[60vh]">本文。</p>
        </article>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** 最初の節を越えると帯が出る。押すと節の一覧が開く。 */
export const Default: Story = {};

/** 節が 1 つしかない記事では、名前を出しても行き先が無いので描かない。 */
export const SingleSection: Story = {
  args: { headings: [{ id: "intro", text: "はじめに", level: 2 }] },
};

/** 見出しが無ければ描かない。 */
export const Empty: Story = {
  args: { headings: [] },
};
