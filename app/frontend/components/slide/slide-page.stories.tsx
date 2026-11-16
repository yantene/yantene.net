import { sampleSlideContext } from "./slide-fixture";
import { SlidePage } from "./slide-page";
import type { Meta, StoryObj } from "@storybook/react-vite";

/*
 * スライドの 1 ページ。置き方は中身の形から決まる (書き手は選べない)。
 *
 * 枠 (`slide-frame`) は再生の部品が持つので、ここでは同じ器を外から当てる。
 */
const context = sampleSlideContext();

function pageAt(index: number): (typeof context.deck.pages)[number] {
  const page = context.deck.pages[index];
  if (page === undefined) throw new Error(`the sample deck has no page ${String(index)}`);
  return page;
}

const meta: Meta<typeof SlidePage> = {
  title: "Slide/SlidePage",
  component: SlidePage,
  args: { context, step: Number.POSITIVE_INFINITY, number: 1, page: pageAt(0) },
  decorators: [
    (Story) => (
      <div className="w-full max-w-5xl px-6">
        <div className="slide-frame is-current">
          <Story />
        </div>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** 表紙。題・書き手・発表の場。 */
export const Cover: Story = {};

/** 章の扉。全体の中の位置を出す。 */
export const Chapter: Story = { args: { page: pageAt(1), number: 2 } };

/** 列挙。強調は色で言う。 */
export const Bullets: Story = { args: { page: pageAt(2), number: 3 } };

/** 題だけ。一言のページ。 */
export const Statement: Story = { args: { page: pageAt(3), number: 4 } };

/** 図と列挙。並べ方は図の縦横比で決まる。 */
export const FigureAndBullets: Story = { args: { page: pageAt(5), number: 6 } };

/** 番号付きリストと Alert。段を持つページの、全部出した姿。 */
export const Steps: Story = { args: { page: pageAt(6), number: 7 } };

/** 表だけ。表を真ん中に。 */
export const Table: Story = { args: { page: pageAt(7), number: 8 } };

/** 引用だけ。引用を大きく。 */
export const Quote: Story = { args: { page: pageAt(8), number: 9 } };

/** コード。 */
export const Code: Story = { args: { page: pageAt(9), number: 10 } };

/** 数式。 */
export const Math: Story = { args: { page: pageAt(10), number: 11 } };

/** 参考。脚注を最後の 1 枚にまとめる。 */
export const References: Story = { args: { page: pageAt(12), number: 13 } };
