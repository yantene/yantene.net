import { NoteTimeline } from "./note-timeline";
import type { Meta, StoryObj } from "@storybook/react-vite";

const notes = [
  {
    slug: "cloudflare-workers-blog",
    title: "Cloudflare Workers + Hono + React でつくる個人ブログの現在地",
    summary:
      "なぜまたブログを自作しているのか。アーキテクチャと設計思想のメモ。",
    imageUrl: "https://picsum.photos/seed/note-a/640/400",
    tags: ["Web", "プログラミング"],
    publishedOn: "2026-05-08",
  },
  {
    slug: "clean-architecture",
    title: "Clean Architecture を Web アプリに適用してみた",
    summary: "境界を引くことで見えてくる、本当にテストしたいもの。",
    imageUrl: "https://picsum.photos/seed/note-b/640/400",
    tags: ["プログラミング", "備忘録"],
    publishedOn: "2026-04-21",
  },
  {
    slug: "type-safety",
    title: "型安全に向き合うと、開発体験はこう変わる",
    summary: "TypeScript、Hono、Drizzle の相性についての所感。",
    imageUrl: null,
    tags: ["プログラミング"],
    publishedOn: "2026-01-02",
  },
  {
    slug: "adr-for-adr",
    title: "自分のサイトの ADR を ADR で管理するという話",
    summary: "迷った記録を残すことは、未来の自分へのインターフェースになる。",
    imageUrl: "https://picsum.photos/seed/note-d/640/400",
    tags: ["備忘録", "日記"],
    publishedOn: "2025-10-15",
  },
];

const meta: Meta<typeof NoteTimeline> = {
  title: "NoteTimeline/NoteTimeline",
  component: NoteTimeline,
  args: { notes },
  decorators: [
    (Story) => (
      <div className="w-full max-w-5xl px-6">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** サムネイルが無い記事は、その列ごと詰まる。 */
export const WithoutImages: Story = {
  args: { notes: notes.map((note) => ({ ...note, imageUrl: null })) },
};

/** 1 件のときは、繋ぐ相手がいないので縦線を出さない。 */
export const SingleNote: Story = {
  args: { notes: notes.slice(0, 1) },
};

/**
 * 順位付きの並び (人気のノートなど)。項目の作りは時系列のものと同じで、先頭の印だけが
 * 公開月のドットから番号に変わる。時系列ではないので縦線は引かれない。
 */
export const Ranked: Story = {
  args: { ranked: true },
};

/** 年で束ねた並び。線は年をまたいでも途切れず、年ラベルだけが左に立つ。 */
export const GroupedByYear: Story = {
  args: { groupByYear: true },
};

/**
 * 書いた量が年ごとに偏っている場合。年は等間隔に並ばず、束の大きさがそのまま
 * 線の長さになる (実データもこの形で、ある年に大半が集中している)。
 */
export const UnevenYears: Story = {
  args: {
    groupByYear: true,
    notes: [
      ...Array.from({ length: 2 }, (_, index) => ({
        slug: `recent-${String(index)}`,
        title: `最近書いたノート ${String(index + 1)}`,
        summary: "ぽつぽつ書いている時期。",
        imageUrl: null,
        tags: ["日記"],
        publishedOn: `2026-0${String(index + 1)}-10`,
      })),
      ...Array.from({ length: 9 }, (_, index) => ({
        slug: `burst-${String(index)}`,
        title: `よく書いていた頃のノート ${String(index + 1)}`,
        summary: "この年に集中して書いていた。",
        imageUrl: null,
        tags: ["日記"],
        publishedOn: `2020-${String(index + 1).padStart(2, "0")}-05`,
      })),
    ],
  },
};

/** 公開月ごとのドットの色を一覧する (12 か月で色相が一周する)。 */
export const EveryMonth: Story = {
  args: {
    notes: Array.from({ length: 12 }, (_, index) => {
      const month = String(index + 1).padStart(2, "0");
      return {
        slug: `month-${month}`,
        title: `${String(index + 1)} 月に公開したノート`,
        summary: "ドットの色は公開月を 1 年の位相に見立てて決まる。",
        imageUrl: null,
        tags: ["日記"],
        publishedOn: `2026-${month}-15`,
      };
    }),
  },
};
