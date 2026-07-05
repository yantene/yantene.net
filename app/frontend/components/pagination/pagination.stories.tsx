import { Pagination } from "./pagination";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof Pagination> = {
  title: "Pagination/Pagination",
  component: Pagination,
  parameters: { layout: "centered" },
  args: {
    hrefForPage: (page: number) => `?page=${String(page)}`,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const FirstPage: Story = {
  args: { page: 1, totalPages: 5 },
};

export const MiddlePage: Story = {
  args: { page: 3, totalPages: 5 },
};

export const LastPage: Story = {
  args: { page: 10, totalPages: 10 },
};

export const ManyPagesWithEllipsis: Story = {
  args: { page: 8, totalPages: 20 },
};

export const SinglePageRendersNothing: Story = {
  args: { page: 1, totalPages: 1 },
};
