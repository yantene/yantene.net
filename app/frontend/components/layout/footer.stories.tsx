import { Footer } from "./footer";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof Footer> = {
  title: "Layout/Footer",
  component: Footer,
  // 年は実際にはページの loader が決めて渡ってくる。ここは時計を読まず固定値を置く
  // (日付でストーリーの見た目が変わらないようにするため)。
  args: {
    year: 2026,
  },
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
