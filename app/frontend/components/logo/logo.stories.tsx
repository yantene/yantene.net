import { Logo } from "./logo";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof Logo> = {
  title: "Layout/Logo",
  component: Logo,
  args: { className: "h-10 w-auto" },
  decorators: [
    (Story) => (
      <div className="p-6 text-base-content">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** ヘッダーに出る大きさ (40px)。並びの詰め方はこの大きさで見ること。 */
export const Default: Story = {};

/** OG カードに出る大きさ (64px)。 */
export const Card: Story = { args: { className: "h-16 w-auto" } };

/** 塗りは呼ぶ側の `color` を継ぐ。ここで色が変わらなければ契約が壊れている。 */
export const InheritsColour: Story = {
  decorators: [
    (Story) => (
      <div className="p-6 text-primary">
        <Story />
      </div>
    ),
  ],
};
