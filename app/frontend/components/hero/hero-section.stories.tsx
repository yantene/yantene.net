import { HeroSection } from "./hero-section";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof HeroSection> = {
  title: "Hero/HeroSection",
  component: HeroSection,
  parameters: {
    layout: "fullscreen",
  },
  /*
   * 本番では loader が実際の時刻と月齢を渡すが、ここは南中の満月に固定する。
   * 見た目を見比べる場所なので、開くたびに空が変わると差分が読めない。
   */
  args: {
    clockOrigin: { minutesOfDay: 12 * 60, moonAgeDay: 14 },
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/**
 * 一日を 24 秒に縮めて、空・太陽・月・雲がひと巡りする様子をまとめて見る。
 * 実際のサイトは 288 秒で 1 日。
 */
export const FastCycle: Story = {
  decorators: [
    (Story) => (
      <div className="hero-clock-fast">
        <Story />
      </div>
    ),
  ],
};
