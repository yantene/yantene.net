import { Footer } from "./footer";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof Footer> = {
  title: "Layout/Footer",
  component: Footer,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/*
 * 年は loader が決めるので、ここでは固定値を渡す。実時刻を読むと撮り比べのたびに
 * 表示が変わる。
 */
export const Default: Story = {
  args: {
    year: 2026,
  },
};
