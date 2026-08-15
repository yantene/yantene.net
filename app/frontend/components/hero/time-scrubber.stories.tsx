import { Celestim } from "./celestim";
import { Cityscape } from "./cityscape";
import { TimeScrubber } from "./time-scrubber";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof TimeScrubber> = {
  title: "Hero/TimeScrubber",
  component: TimeScrubber,
  parameters: { layout: "fullscreen" },
  // 本番では loader が渡す。ここは空の既定 (南中) と揃えて固定する。
  args: { initialMinutes: 12 * 60 },
  decorators: [
    // 目盛りも歩行者もヒーローの下端に絶対配置されるので、高さのある器を与える。
    (Story) => (
      <div className="hero-clock relative h-72 overflow-hidden bg-base-100">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** 目盛りを掴んで左右に引くと時間が進む (この単体では動かす相手が目盛りだけ)。 */
export const Default: Story = {};

/** 本来の置かれ方。目盛りを引くと空と街の雲も一緒に動く。 */
export const WithSky: Story = {
  decorators: [
    (Story) => (
      <div className="hero-clock relative h-72 overflow-hidden">
        <div className="absolute inset-0">
          <Celestim veil />
        </div>
        <Cityscape />
        <Story />
      </div>
    ),
  ],
};
