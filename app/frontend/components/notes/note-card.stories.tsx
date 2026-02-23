import { MemoryRouter } from "react-router";
import { NoteCard } from "./note-card";
import type { Meta, StoryObj } from "@storybook/react-vite";

/* eslint-disable no-secrets/no-secrets -- Unsplash sample URLs */
const SAMPLE_IMAGES = {
  space:
    "https://images.unsplash.com/photo-1532978379173-523e16f371f2?w=800&h=400&fit=crop",
  code: "https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=800&h=400&fit=crop",
  server:
    "https://images.unsplash.com/photo-1504639725590-34d0984388bd?w=800&h=400&fit=crop",
} as const;
/* eslint-enable no-secrets/no-secrets */

const meta: Meta<typeof NoteCard> = {
  title: "Notes/NoteCard",
  component: NoteCard,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div className="max-w-sm">
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  parameters: {
    layout: "centered",
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const WithImage: Story = {
  args: {
    note: {
      id: "1",
      slug: "example-note",
      title: "純粋な CSS で天体の運行をシミュレーションする",
      publishedOn: "2026-02-18",
      lastModifiedOn: "2026-02-18",
      imageUrl: SAMPLE_IMAGES.space,
      summary:
        "このサイトのヒーローセクションの背景で動いている太陽と月。実はこれ、JavaScript を一切使わず、純粋な CSS だけで実現している。",
    },
  },
};

export const WithoutImage: Story = {
  args: {
    note: {
      id: "2",
      slug: "no-image-note",
      title: "画像なしの記事",
      publishedOn: "2026-01-15",
      lastModifiedOn: "2026-01-15",
      imageUrl: "",
      summary: "サムネイル画像が設定されていない場合の表示例。",
    },
  },
};

export const LongTitle: Story = {
  args: {
    note: {
      id: "3",
      slug: "long-title-note",
      title:
        "とても長いタイトルの記事がどのように表示されるかを確認するためのストーリー",
      publishedOn: "2026-01-10",
      lastModifiedOn: "2026-01-10",
      imageUrl: SAMPLE_IMAGES.code,
      summary:
        "タイトルが長い場合に line-clamp が正しく機能するかどうかの確認。",
    },
  },
};

export const NoSummary: Story = {
  args: {
    note: {
      id: "4",
      slug: "no-summary-note",
      title: "サマリーなしの記事",
      publishedOn: "2026-01-05",
      lastModifiedOn: "2026-01-05",
      imageUrl: SAMPLE_IMAGES.server,
      summary: "",
    },
  },
};
