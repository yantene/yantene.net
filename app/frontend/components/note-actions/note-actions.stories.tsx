import { NoteActions } from "./note-actions";
import type { Meta, StoryObj } from "@storybook/react-vite";

/*
 * ReactionBar は `useFetcher` を使うため、データルータの外では送信まで動かない。
 * ここで確かめるのは並びと余白 (上下で主張の強さが変わること)。押した後の見た目は
 * Reaction/ReactionBar の stories が持つ。
 */
const meta: Meta<typeof NoteActions> = {
  title: "NoteActions/NoteActions",
  component: NoteActions,
  args: {
    url: "https://yantene.net/notes/hacku-2016",
    title: "オートマチック・オタク・マッチング",
    reactions: [
      { emoji: "❤️", count: 12 },
      { emoji: "🎉", count: 3 },
    ],
    mine: null,
  },
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl p-6">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** 本文の手前。主張を抑え、細い線で本文と隔てる。 */
export const Top: Story = {
  args: { placement: "top" },
};

/** 読み終えた足元。本文との間を広く取る。 */
export const Bottom: Story = {
  args: { placement: "bottom" },
};

/** 自分が押している状態。まとまりが縁取られる。 */
export const Reacted: Story = {
  args: { placement: "bottom", mine: "🎉" },
};

/** まだ誰も押していない記事。 */
export const Untouched: Story = {
  args: { placement: "bottom", reactions: [] },
};
