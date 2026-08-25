import { Footer } from "./footer";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof Footer> = {
  title: "Layout/Footer",
  component: Footer,
  // 期間は実際にはページの loader が決めて渡ってくる。ここは時計を読まず固定値を置く
  // (日付でストーリーの見た目が変わらないようにするため)。
  args: {
    copyright: { from: 2019, to: 2026 },
  },
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 公開したノートが 1 年ぶんしか無いとき。期間ではなく 1 つの年だけを出す。 */
export const SingleYear: Story = {
  args: { copyright: { from: 2026, to: 2026 } },
};
