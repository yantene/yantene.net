import { MemoryRouter } from "react-router";
import { Header } from "./header";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof Header> = {
  title: "Layout/Header",
  component: Header,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
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
