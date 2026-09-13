import { SearchTrigger } from "./search-trigger";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof SearchTrigger> = {
  title: "Search/SearchTrigger",
  component: SearchTrigger,
  args: {
    onOpen: () => undefined,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/*
 * 白地の帯に載せた姿。
 *
 * 鍵の名前は読み手の OS で変わる (Mac なら `⌘`、それ以外は `Ctrl`)。Storybook が
 * 動いているブラウザの OS がそのまま出る。
 */
export const Default: Story = {};

/*
 * 透過ヘッダーに載せた姿。動く空の上でも字と鍵が沈まないことを確かめる。
 *
 * **囲みに `site-header-overlay` を着せること。** 器 (縁と地) と弱めた字の濃さは
 * このクラスが差し替えており (header.css)、着せないと白地の姿が空の上に出る。それは
 * 実物と違ううえ、いちばん見たい「面を持たない検索が読めるか」が確かめられない。
 */
export const OnSky: Story = {
  decorators: [
    (Story) => (
      <div className="site-header-overlay flex h-24 items-center justify-center bg-sky-300">
        <Story />
      </div>
    ),
  ],
};

/*
 * 検索欄を畳む幅の姿。字と鍵が消え、絵だけが残る。
 *
 * 名前が `aria-label` に残っていることは見た目からは分からないので、崩れていないこと
 * だけをここで見る (名前そのものは search-trigger.tsx のコメントが担保する)。
 */
export const Narrow: Story = {
  globals: {
    viewport: { value: "mobile1", isRotated: false },
  },
};
