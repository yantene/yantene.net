import { NavigationProgress } from "./navigation-progress";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof NavigationProgress> = {
  title: "Navigation/NavigationProgress",
  component: NavigationProgress,
  args: {
    isPending: true,
    label: "読み込み中",
  },
  decorators: [
    // 帯は画面上端に固定で出るので、下に地の内容を敷いて位置関係が見えるようにする。
    (Story) => (
      <div className="min-h-48 bg-base-100 p-6">
        <Story />
        <p className="text-sm text-base-content/60">
          遷移中は画面の上端に帯が流れる。押した場所によらず出る場所は変わらない。
        </p>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** 遷移中。出るまでに 150 ms の待ちがあるので、開いた直後は少し間が空く。 */
export const Pending: Story = {};

/** 遷移していないとき。読み上げ用の入れ物だけが残り、何も見えない。 */
export const Idle: Story = {
  args: { isPending: false },
};
