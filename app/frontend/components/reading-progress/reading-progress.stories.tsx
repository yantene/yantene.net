import { ReadingProgress } from "./reading-progress";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof ReadingProgress> = {
  title: "Navigation/ReadingProgress",
  component: ReadingProgress,
  decorators: [
    /*
     * 帯は画面上端に固定で出て、文書そのもののスクロールに繋がっている。Storybook の
     * 枠内では文書が縦に伸びないと動かないので、地の内容を高く積んでおく。
     */
    (Story) => (
      <div className="bg-base-100 p-6">
        <Story />
        <p className="text-sm text-base-content/60">
          画面を狭く (1024px 未満に) してから縦にスクロールすると、上端の帯が伸びる。
        </p>
        <div className="mt-6 h-[200vh] rounded bg-base-200" />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** 携帯幅。スクロールに合わせて上端の帯が左から右へ伸びる。 */
export const Default: Story = {};
