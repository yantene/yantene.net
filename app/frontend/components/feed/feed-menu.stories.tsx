import { FeedMenu, FeedMenuList } from "./feed-menu";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof FeedMenu> = {
  title: "Feed/FeedMenu",
  component: FeedMenu,
  /*
   * 板は最前面 (top layer) に出て、押した絵の直下に寄る (CSS anchor positioning)。
   * Storybook にはヘッダーが無いので、帯に見立てた囲みを立てて、その中に絵を置く。
   */
  decorators: [
    (Story) => (
      <div className="h-80 bg-base-200">
        <div className="flex justify-end bg-white px-6 py-3">
          <Story />
        </div>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/* 畳んだ姿。帯には RSS の絵だけが残る。 */
export const Closed: Story = {};

/*
 * 開いた姿。All / Articles / Slides が縦に積まれる。
 *
 * **Slides はまだ中身が無い** (#415) が、押せる導線として出す。返るのは entry 0 件の
 * Atom で、いま購読しておけば中身が入った時点で届く。
 *
 * `showPopover()` で開く。器が popover なので、これは読み手が絵を押したときと同じ状態に
 * なる。
 */
export const Open: Story = {
  play: ({ canvasElement }) => {
    canvasElement.querySelector<HTMLElement>("[popover]")?.showPopover();
  },
};

/*
 * ドロワー (狭い画面) に置く姿。
 *
 * **畳んだ中で更に畳まない。** ドロワー自身が畳んだ板 (popover) なので、入れ子にすると
 * 開くのに 2 手かかる。行き先は帯と同じ表から引くので、出来ることは変わらない。
 */
export const InDrawer: StoryObj<typeof FeedMenuList> = {
  decorators: [
    (Story) => (
      <div className="w-72 bg-base-100 p-4">
        <Story />
      </div>
    ),
  ],
  render: () => <FeedMenuList />,
};
