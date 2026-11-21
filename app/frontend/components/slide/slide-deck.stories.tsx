import { SlideDeck } from "./slide-deck";
import { sampleSlideContext, sampleSlideLabels } from "./slide-fixture";
import type { Meta, StoryObj } from "@storybook/react-vite";

/*
 * スライドの再生。矢印キー・PageDown / PageUp・クリックで送る。
 *
 * 幅は個別ページと同じ 1024px (max-w-5xl)。枠は 16:9 を保ち、中身は枠の幅に従って
 * 拡大縮小される。
 */
const meta: Meta<typeof SlideDeck> = {
  title: "Slide/SlideDeck",
  component: SlideDeck,
  args: { context: sampleSlideContext(), labels: sampleSlideLabels },
  decorators: [
    (Story) => (
      <div className="w-full max-w-5xl px-6">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** 見本のデッキ。意味の語彙を 1 回ずつ使ってある。 */
export const Default: Story = {};

/** 狭い幅。字も余白も同じ比で縮むこと (折り返しの位置が変わらないこと)。 */
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};
