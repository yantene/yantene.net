import { TableOfContents, type TocHeading } from "./table-of-contents";
import type { Meta, StoryObj } from "@storybook/react-vite";

const headings: TocHeading[] = [
  { id: "intro", text: "はじめに", level: 2 },
  { id: "setup", text: "セットアップ", level: 2 },
  { id: "install", text: "インストール", level: 3 },
  { id: "config", text: "設定", level: 3 },
  { id: "usage", text: "使い方", level: 2 },
];

const meta: Meta<typeof TableOfContents> = {
  title: "TableOfContents/TableOfContents",
  component: TableOfContents,
  parameters: { layout: "padded" },
  args: { title: "目次", headings },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
