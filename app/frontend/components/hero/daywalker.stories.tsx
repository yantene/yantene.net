import { Daywalker } from "./daywalker";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof Daywalker> = {
  title: "Hero/Daywalker",
  component: Daywalker,
  parameters: { layout: "fullscreen" },
  decorators: [
    // 地平線 (目盛りの帯の上端) に足を着けて立つので、帯のぶんの高さを持つ器に置く。
    (Story) => (
      <div className="hero-clock relative h-56 bg-base-100">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
