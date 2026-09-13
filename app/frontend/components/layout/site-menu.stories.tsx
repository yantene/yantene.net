import { SiteMenu } from "./site-menu";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof SiteMenu> = {
  title: "Layout/SiteMenu",
  component: SiteMenu,
  /*
   * 開いた板はヘッダー (sticky / absolute) を基準に置かれる。Storybook にはヘッダーが
   * 無いので、同じ役をする囲みを立てる。これが無いと板が画面の左上へ飛ぶ。
   */
  decorators: [
    (Story) => (
      <div className="h-96 bg-base-200">
        {/* 板はこの帯を基準に、その真下いっぱいに広がる。 */}
        <div className="relative flex justify-end bg-white px-6 py-3">
          <Story />
        </div>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/* 畳んだ姿。帯にはハンバーガーだけが残る。 */
export const Closed: Story = {};

/*
 * 開いた姿。行き先・表示言語・出ていく先が縦に積まれる。
 *
 * `open` 属性を直に立てて開く。器が `<details>` なので、これは読み手がハンバーガーを
 * 押したときと同じ状態になる (share-menu.stories.tsx と同じ手)。
 */
export const Open: Story = {
  play: ({ canvasElement }) => {
    canvasElement.querySelector("details")?.setAttribute("open", "");
  },
};
