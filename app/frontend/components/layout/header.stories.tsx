import { Header } from "./header";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof Header> = {
  title: "Layout/Header",
  component: Header,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Solid: Story = {
  args: {
    variant: "solid",
  },
};

export const Transparent: Story = {
  args: {
    variant: "transparent",
  },
  decorators: [
    (Story) => (
      <div className="relative h-48 bg-sky-300">
        <Story />
      </div>
    ),
  ],
};

/*
 * トップページの姿。ヒーローが同じ「やんてね」を出すのでロゴを伏せる。
 * ロゴが無くてもナビと検索が右端に留まることを、ここで見て確かめられる。
 */
export const TransparentWithoutLogo: Story = {
  args: {
    variant: "transparent",
    showLogo: false,
  },
  decorators: [
    (Story) => (
      <div className="relative h-48 bg-sky-300">
        <Story />
      </div>
    ),
  ],
};

/*
 * 検索フォームを畳む幅の姿。Notes の字と検索欄が消え、同じ /notes を指す虫眼鏡だけが
 * 残ることを確かめる。同じ行き先のリンクを 2 つ並べた回帰 (#154) を見張る場所。
 */
export const SolidNarrow: Story = {
  args: {
    variant: "solid",
  },
  globals: {
    viewport: { value: "mobile1", isRotated: false },
  },
};

/* 下層ページでロゴを伏せる使い方は今のところ無いが、変種の組み合わせとして見られるように。 */
export const SolidWithoutLogo: Story = {
  args: {
    variant: "solid",
    showLogo: false,
  },
};
