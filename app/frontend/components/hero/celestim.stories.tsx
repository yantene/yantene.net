import { Celestim } from "./celestim";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ComponentProps } from "react";

const meta: Meta<typeof Celestim> = {
  title: "Hero/Celestim",
  component: Celestim,
  decorators: [
    (Story) => (
      <div className="relative h-96 w-full overflow-hidden">
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<ComponentProps<typeof Celestim>>;

export const Default: Story = {};

export const FastCycle: Story = {
  args: {
    dayDuration: 24,
  },
};

/** 文字を重ねる用途 (ヒーロー) の見え方。夜側ほど白が濃くなる。 */
export const Veiled: Story = {
  args: {
    dayDuration: 24,
    veil: true,
  },
};

export const SlowCycle: Story = {
  args: {
    dayDuration: 600,
  },
};
