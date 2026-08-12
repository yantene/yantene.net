import { ReactionBar } from "./reaction-bar";
import type { Meta, StoryObj } from "@storybook/react-vite";

/*
 * `useFetcher` はデータルーターの中でしか動かない。preview の MemoryRouter だけでは
 * 足りないので、ここでは押した後の見た目 (props で決まる部分) を確かめる用途に絞る。
 * 送信中の楽観表示は reaction-state.test.ts が押さえている。
 */
const meta: Meta<typeof ReactionBar> = {
  title: "Reaction/ReactionBar",
  component: ReactionBar,
};

export default meta;
type Story = StoryObj<typeof meta>;

/** まだ誰も押していない記事。ハートだけが出る。 */
export const Untouched: Story = {
  args: {
    reactions: [],
    mine: null,
  },
};

/** 押されているが、自分はまだ押していない。 */
export const Reacted: Story = {
  args: {
    reactions: [
      { emoji: "❤️", count: 12 },
      { emoji: "🎉", count: 3 },
      { emoji: "🤔", count: 1 },
    ],
    mine: null,
  },
};

/** 自分がハートを押した状態。ハートが塗られ、その絵文字が強調される。 */
export const LikedByMe: Story = {
  args: {
    reactions: [
      { emoji: "❤️", count: 13 },
      { emoji: "🎉", count: 3 },
    ],
    mine: "❤️",
  },
};

/** ハート以外を選んだ状態。ハートは押されていない見た目に戻る。 */
export const OtherEmojiByMe: Story = {
  args: {
    reactions: [
      { emoji: "❤️", count: 12 },
      { emoji: "🎉", count: 4 },
    ],
    mine: "🎉",
  },
};
