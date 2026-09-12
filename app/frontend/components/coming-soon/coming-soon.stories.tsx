import { ComingSoon } from "./coming-soon";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof ComingSoon> = {
  title: "ComingSoon/ComingSoon",
  component: ComingSoon,
  parameters: {
    layout: "fullscreen",
  },
  decorators: [
    (Story) => (
      <div className="flex min-h-96 flex-col">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const About: Story = {
  args: {
    heading: "About",
    description: "A profile, and what I have been up to.",
  },
};

export const Notes: Story = {
  args: {
    heading: "Notes",
    description: "Short posts, the kind that do not need a title.",
  },
};

export const Slides: Story = {
  args: {
    heading: "Slides",
    description: "Slides from talks, and the decks that never became one.",
  },
};
