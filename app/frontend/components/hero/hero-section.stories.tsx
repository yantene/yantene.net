import { HeroSection } from "./hero-section";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof HeroSection> = {
  title: "Hero/HeroSection",
  component: HeroSection,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
