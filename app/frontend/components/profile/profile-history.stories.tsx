import { sampleHistory } from "./profile-fixture";
import { ProfileHistory } from "./profile-history";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof ProfileHistory> = {
  title: "Profile/ProfileHistory",
  component: ProfileHistory,
  args: { history: sampleHistory },
  decorators: [
    /*
     * 上に余白を置く。章の名前は sticky で、ヘッダーの下 (4.5rem) で止まる。Storybook には
     * ヘッダーが無いので、余白を置かないと最初から吸着した姿で出て、章と最初の出来事が
     * ずれているように見える。
     */
    (Story) => (
      <div className="w-full max-w-3xl px-6 pt-24 pb-12">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 章が 1 つ・出来事が 1 件のとき。縦線を引く相手がいないので線は出ない。 */
export const SingleEntry: Story = {
  args: { history: [{ chapter: "社会人", entries: [sampleHistory[1].entries[0]] }] },
};

/** 章が 1 つで出来事が複数。端の切り上げ・切り下げだけが働く。 */
export const SingleChapter: Story = {
  args: { history: [sampleHistory[1]] },
};

export const Narrow: Story = {
  globals: { viewport: { value: "mobile1", isRotated: false } },
};
