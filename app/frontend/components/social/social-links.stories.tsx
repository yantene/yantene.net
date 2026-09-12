import { SocialLinks } from "./social-links";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof SocialLinks> = {
  title: "Social/SocialLinks",
  component: SocialLinks,
};

export default meta;
type Story = StoryObj<typeof meta>;

/* ヘッダーの右端に並ぶ姿。地が白なので muted で置く。 */
export const InHeader: Story = {
  args: {
    className: "flex items-center gap-3",
    linkClassName:
      "press-control inline-flex text-lg text-muted-foreground transition-colors hover:text-primary",
  },
};

/* ヒーローの中央に並ぶ姿。動く空の上に載るので、字と同じく濃いめに置く。 */
export const InHero: Story = {
  args: {
    className: "flex items-center gap-5",
    linkClassName:
      "press-control inline-flex text-2xl text-foreground/85 transition-colors hover:text-primary",
  },
};

/*
 * ドロワーの足元に並ぶ姿。指で押すので、ヘッダーより広く空けてある。
 */
export const InDrawer: Story = {
  args: {
    className: "flex items-center gap-4",
    linkClassName:
      "press-control inline-flex text-xl text-muted-foreground transition-colors hover:text-primary",
  },
};
