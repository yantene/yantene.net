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

export const SlowCycle: Story = {
  args: {
    dayDuration: 600,
  },
};
