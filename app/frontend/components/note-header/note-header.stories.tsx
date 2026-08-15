import { NoteHeader } from "./note-header";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof NoteHeader> = {
  title: "NoteHeader/NoteHeader",
  component: NoteHeader,
  args: {
    slug: "hello-world",
    title: "はじめてのノート",
    imageUrl: "https://picsum.photos/seed/yantene/1200/514",
    tags: ["エッセイ", "日記"],
    publishedOn: "2026-05-08",
    origin: "https://yantene.net",
  },
  decorators: [
    // 記事ページと同じ幅に置く。表題の折り返しは幅で決まる。
    (Story) => (
      <div className="w-full max-w-3xl px-6">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** カバー画像を持たない記事。表題から始まる。 */
export const WithoutCover: Story = {
  args: { imageUrl: null },
};

/** タグを持たない記事。 */
export const WithoutTags: Story = {
  args: { tags: [] },
};

/** 折り返す長さの表題と、多めのタグ。 */
export const LongTitle: Story = {
  args: {
    title:
      "Cloudflare Workers と Hono と React Router v7 で個人サイトを組み直したときに考えていたこと",
    tags: ["Cloudflare", "Hono", "React Router", "設計", "ふりかえり"],
  },
};

/*
 * 幅の狭い画面。表題の字が一段小さくなる (note-header.css の `width < 40rem`)。
 *
 * 幅は `globals` で与える。Storybook 10 が読むのはこちらで、`parameters.viewport` に
 * 置いても選ばれず、既定の幅のまま描かれてしまう。
 */
export const Narrow: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
};
