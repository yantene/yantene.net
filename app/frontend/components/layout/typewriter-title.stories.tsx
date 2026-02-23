import { TypewriterTitle } from "./typewriter-title";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof TypewriterTitle> = {
  title: "Layout/TypewriterTitle",
  component: TypewriterTitle,
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithCustomClass: Story = {
  args: {
    className: "text-xl font-bold tracking-tight text-foreground",
  },
};
