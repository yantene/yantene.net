import { NoteCard } from "./note-card";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof NoteCard> = {
  title: "NoteCard/NoteCard",
  component: NoteCard,
  parameters: { layout: "centered" },
  args: {
    slug: "hello-world",
    title: "はじめてのノート",
    summary:
      "これはノートの要約です。一覧やホームの新着カードに、先頭 160 文字ほどが表示されます。",
    imageUrl: null,
    tags: ["日記", "プログラミング"],
    publishedOn: "2026-01-15",
  },
  decorators: [
    (Story) => (
      <div className="w-80">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Placeholder: Story = {};

export const WithImage: Story = {
  args: { imageUrl: "https://picsum.photos/seed/yantene/640/360" },
};

export const NoTags: Story = {
  args: { tags: [] },
};
