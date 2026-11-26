import { ShareBar } from "./share-bar";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof ShareBar> = {
  title: "Share/ShareBar",
  component: ShareBar,
  args: {
    url: "https://yantene.net/articles/hacku-2016",
    title: "オートマチック・オタク・マッチング ― Hack U 2016 名古屋会場に参加しました",
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/*
 * Storybook のブラウザが共有シートを持っていれば、末尾に共有シートの押し場所も出る
 * (navigator.share の有無で決まる)。
 */
export const Default: Story = {};

/* 狭い幅では帯の中で折り返す。 */
export const Narrow: Story = {
  decorators: [
    (Story) => (
      <div className="w-72">
        <Story />
      </div>
    ),
  ],
};
