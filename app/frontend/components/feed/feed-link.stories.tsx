import { FeedLink } from "./feed-link";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof FeedLink> = {
  title: "Feed/FeedLink",
  component: FeedLink,
};

export default meta;
type Story = StoryObj<typeof meta>;

/** サイト全体のフィード (既定)。 */
export const Default: Story = {};

/** フッターの帯に載せるときの小さめの見た目。 */
export const Small: Story = {
  args: {
    className: "text-xs text-base-content/80",
  },
};
