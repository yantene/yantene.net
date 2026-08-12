import { ShareMenu } from "./share-menu";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof ShareMenu> = {
  title: "Share/ShareMenu",
  component: ShareMenu,
  args: {
    url: "https://yantene.net/notes/hacku-2016",
    title:
      "オートマチック・オタク・マッチング ― Hack U 2016 名古屋会場に参加しました",
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};

/*
 * 開いた姿。Storybook には共有シートが無いので、ここで見えるのは常に一覧側 (共有シートを
 * 呼べない環境と、JS が動かない環境で出るもの) になる。
 */
export const Open: Story = {
  decorators: [
    (Story) => (
      <div className="pb-64">
        <Story />
      </div>
    ),
  ],
  play: ({ canvasElement }) => {
    canvasElement.querySelector("details")?.setAttribute("open", "");
  },
};

/* 長い題は一覧の幅を押し広げない (共有先の URL にだけ効く) ことを見る。 */
export const LongTitle: Story = {
  args: {
    title:
      "Windows タブレット KEIAN KVI-70B に Arch Linux をインストールする手順のすべて",
  },
};
