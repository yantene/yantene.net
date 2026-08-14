import { ReactionHint } from "./reaction-hint";
import type { Meta, StoryObj } from "@storybook/react-vite";

/*
 * 促しは「閉じた記録が localStorage に無いとき」だけ出る。Storybook は同じタブで
 * 何度も開くので、描く前に記録を消しておかないと 2 回目から出なくなる。
 */
const forgetDismissal = (): void => {
  try {
    globalThis.localStorage.removeItem("yantene:reaction-hint-dismissed");
  } catch {
    // 読めない環境では何もしなくてよい (そこでは元から出ない)。
  }
};

const meta: Meta<typeof ReactionHint> = {
  title: "Reaction/ReactionHint",
  component: ReactionHint,
  /*
   * 実際はリアクションの行の上に浮かぶ。位置の基準になる入れ物が要るので、
   * note-actions と同じ形 (position: relative) を用意して、行の代わりに枠を置く。
   */
  decorators: [
    (Story) => {
      forgetDismissal();
      return (
        // 促しは行の「上」に浮かぶので、上に見る余地を作っておく。
        <div className="p-6 pt-28">
          <div className="note-actions-reactions">
            <div className="reaction-bar">
              <span className="reaction-chip">
                <span className="reaction-chip-emoji">❤️</span>
                <span className="reaction-chip-count">0</span>
              </span>
            </div>
            <Story />
          </div>
        </div>
      );
    },
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** 既定の姿。バツを押すと消え、以降は出なくなる (localStorage に記録される)。 */
export const Default: Story = {};
