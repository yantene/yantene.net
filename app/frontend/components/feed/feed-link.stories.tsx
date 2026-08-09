import { FeedLink } from "./feed-link";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { feedIdentity } from "~/lib/feed";

const meta: Meta<typeof FeedLink> = {
  title: "Feed/FeedLink",
  component: FeedLink,
};

export default meta;
type Story = StoryObj<typeof meta>;

/** サイト全体のフィード (既定)。 */
export const Default: Story = {};

/** タグで絞った一覧から、そのタグだけのフィードへ送るとき。 */
export const ForTag: Story = {
  args: {
    href: feedIdentity("日記").path,
    label: "日記 feed",
  },
};

/** フッターの帯に載せるときの小さめの見た目。 */
export const Small: Story = {
  args: {
    className: "text-xs text-base-content/80",
  },
};
