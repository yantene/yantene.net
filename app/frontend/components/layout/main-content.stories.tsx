import { MainContent } from "./main-content";
import type { Meta, StoryObj } from "@storybook/react-vite";

/*
 * 見た目を持たない器。className で受けたものをそのまま `<main>` に載せる。
 * スキップリンクと組み合わせた姿は Layout/SkipLink にある。
 */
const meta: Meta<typeof MainContent> = {
  title: "Layout/MainContent",
  component: MainContent,
  args: {
    className: "mx-auto w-full max-w-3xl px-6 py-10",
    children: <p>Main content</p>,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
