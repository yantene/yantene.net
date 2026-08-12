import { EmojiPalette } from "./emoji-palette";
import type { Meta, StoryObj } from "@storybook/react-vite";

/*
 * パレットは開いたときに `/emoji/palette-<locale>.json` を読む。Storybook はその静的
 * ファイルを配らないので、ここでは読み込みに失敗した姿 (と、読み込み中の姿) が見える。
 * 絞り込みの挙動は emoji-palette-data.test.ts が押さえている。
 */
const meta: Meta<typeof EmojiPalette> = {
  title: "Reaction/EmojiPalette",
  component: EmojiPalette,
  args: {
    onPick: () => {},
  },
  decorators: [
    (Story) => (
      <div className="reaction-palette-panel relative">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
