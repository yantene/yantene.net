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
 * ナビを畳む幅の姿。ロゴ・検索の絵・ハンバーガーだけが残り、行き先と表示言語と
 * 出ていく先はドロワーへ移る (SiteMenu)。
 *
 * 見張るのは、同じ行き先が 2 つ出ていないこと。帯とドロワーは同じ表を読んでいるので
 * (site-nav.tsx)、片方だけを直して二重になる回帰 (#154) はここに出る。
 */
export const SolidNarrow: Story = {
  args: {
    variant: "solid",
  },
  globals: {
    viewport: { value: "mobile1", isRotated: false },
  },
};

/*
 * ナビ・検索・表示言語・出ていく先が一列に収まる幅の姿。
 *
 * 境目は lg (1024px)。Storybook の既定 (responsive) では iframe の幅次第で
 * 畳まれることがあるので、広い幅を明示しておく。
 */
export const SolidWide: Story = {
  args: {
    variant: "solid",
  },
  globals: {
    viewport: { value: "desktop", isRotated: false },
  },
};

/* 下層ページでロゴを伏せる使い方は今のところ無いが、変種の組み合わせとして見られるように。 */
export const SolidWithoutLogo: Story = {
  args: {
    variant: "solid",
    showLogo: false,
  },
};
