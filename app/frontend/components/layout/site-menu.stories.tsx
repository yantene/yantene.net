import { SiteMenu } from "./site-menu";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof SiteMenu> = {
  title: "Layout/SiteMenu",
  component: SiteMenu,
  /*
   * 開いた板は最前面 (top layer) に出て、帯の下端 (`--site-header-band`) に吊るされる。
   * Storybook にはヘッダーが無いので、帯と同じ名前の錨を持つ囲みを立てる。
   */
  decorators: [
    (Story) => (
      <div className="h-96 bg-base-200">
        {/* 板はこの帯の真下に、画面の幅いっぱいに広がる。 */}
        <div className="site-header-band flex justify-end bg-white px-6 py-3">
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
 * `showPopover()` で開く。器が popover なので、これは読み手がハンバーガーを押したときと
 * 同じ状態になる。
 */
export const Open: Story = {
  play: ({ canvasElement }) => {
    canvasElement.querySelector<HTMLElement>("[popover]")?.showPopover();
  },
};
