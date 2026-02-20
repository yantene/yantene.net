import { expect, within } from "storybook/test";
import { Welcome } from "./welcome";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta = {
  title: "Welcome",
  component: Welcome,
  args: {
    message: "Hello from Storybook!",
  },
  parameters: {
    layout: "fullscreen",
  },
} satisfies Meta<typeof Welcome>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithCustomMessage: Story = {
  args: {
    message: "カスタムメッセージ",
  },
};

export const InteractionTest: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);

    await expect(canvas.getByText("React Router Docs")).toBeInTheDocument();
    await expect(canvas.getByText("Join Discord")).toBeInTheDocument();
    await expect(canvas.getByText("Hello from Storybook!")).toBeInTheDocument();
  },
};
