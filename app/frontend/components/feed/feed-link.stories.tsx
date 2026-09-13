import { FeedIconLink, FeedLink } from "./feed-link";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof FeedLink> = {
  title: "Feed/FeedLink",
  component: FeedLink,
};

export default meta;
type Story = StoryObj<typeof meta>;

/** サイト全体のフィード (既定)。 */
export const Default: Story = {};

/** 一覧の見出し脇に載せるときの小さめの見た目。 */
export const Small: Story = {
  args: {
    className: "text-xs text-base-content/80",
  },
};

/*
 * 絵だけの姿。ヘッダーの帯とドロワーの足元がこれを使う。
 *
 * 名前は `aria-label` と `title` が持つ。字が無いので、ここで見えるのは絵と押せる
 * 範囲だけ — その範囲が 2rem 角あることを確かめる場所でもある。
 */
export const IconOnly: StoryObj<typeof FeedIconLink> = {
  render: (args) => <FeedIconLink {...args} />,
  args: {
    className:
      "press-control inline-flex h-8 w-8 items-center justify-center text-lg text-muted-foreground transition-colors hover:text-primary",
  },
};
