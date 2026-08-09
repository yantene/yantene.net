import { Celestim } from "./celestim";
import { Cityscape } from "./cityscape";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof Cityscape> = {
  title: "Hero/Cityscape",
  component: Cityscape,
  parameters: { layout: "fullscreen" },
  decorators: [
    // 街は絶対配置でヒーローの下端に貼り付くので、高さのある器を与える。
    (Story) => (
      <div className="hero-clock relative h-96 bg-base-100">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 本来の置かれ方。空の手前に重なり、雲だけが流れる。 */
export const OverSky: Story = {
  decorators: [
    (Story) => (
      <div className="hero-clock hero-clock-fast relative h-96 overflow-hidden">
        <div className="absolute inset-0">
          <Celestim veil />
        </div>
        <Story />
      </div>
    ),
  ],
};
