import { Header } from "./header";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof Header> = {
  title: "Layout/Header",
  component: Header,
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/*
 * 下層ページの姿。**ロゴが帯の真ん中、行き先がその左、道具がその右。**
 *
 * 格子になるのは lg からで、ここは幅を指定していないので Storybook の枠次第。
 * 3 つの島が並ぶ姿を見たいときは SolidWide のほうを見ること。
 */
export const Solid: Story = {
  args: {
    variant: "solid",
  },
};

/*
 * トップページの、読み出す前の姿。
 *
 * **見張るのは、真ん中が空いたままであること。** 帯は格子で組んであり (header.tsx)、
 * 真ん中の升はサイトの名前の場所。ここは畳まれているので軸には何も載らず、すぐ下の
 * ヒーローのロゴタイプが同じ軸に続く。行き先が真ん中へ寄ってきたら、升の指定が
 * 崩れている。
 *
 * ロゴを `showLogo` で伏せてはいない。**巻き上がりきった位置では CSS が畳む**
 * (header.css の site-header-overlay-mark-in)。囲みが巻き上がらないので、ここでは
 * その始端がそのまま出る。幅を明示してあるのは、格子になるのが lg からのため。
 */
export const Transparent: Story = {
  args: {
    variant: "transparent",
  },
  globals: {
    viewport: { value: "desktop", isRotated: false },
  },
  decorators: [
    (Story) => (
      <div className="relative h-48 bg-sky-300">
        <Story />
      </div>
    ),
  ],
};

/*
 * 読み出すと下層のヘッダーに変わるところ。**手で巻き下ろして見ること。**
 *
 * 帯に白地と地平線が差し、真ん中に名前が降りてくる。巻き下ろしきった姿は Solid と
 * 同じになるはずで、そこが揃っていないと、トップと下層で帯が繋がって見えない。
 *
 * 空の板をうんと高くしてあるのは、囲みではなく**枠そのものを巻き下ろす**ため。
 * 効果を駆動しているのは枠の巻き取り量で (`scroll(root block)`)、囲みの中の
 * スクロールでは動かない。
 */
export const TransparentSettling: Story = {
  args: {
    variant: "transparent",
  },
  globals: {
    viewport: { value: "desktop", isRotated: false },
  },
  decorators: [
    (Story) => (
      <div className="relative h-[200vh] bg-linear-to-b from-sky-300 to-base-100">
        <Story />
      </div>
    ),
  ],
};

/*
 * いちばん翳った空に載せた姿。
 *
 * トップの空は Celestim の周期で 4 色を回り、veil を掛けたその底がこの灰色
 * (celestim.css の celestim-veiled-sky-cycle)。**字と縁がここで消えないことを見る。**
 * 白地の 62% では 4.5:1 を割るので、透過ヘッダーだけ --header-ink-dim を 80% に
 * 差し替えてある (header.css)。検索の縁は 1px しかないので、消えるとしたらここ。
 */
export const TransparentOnDimSky: Story = {
  args: {
    variant: "transparent",
  },
  globals: {
    viewport: { value: "desktop", isRotated: false },
  },
  decorators: [
    (Story) => (
      <div className="relative h-48 bg-[rgb(192_195_201)]">
        <Story />
      </div>
    ),
  ],
};

/*
 * ナビを畳む幅の姿。ロゴ・検索の絵・ハンバーガーだけが残り、行き先と表示言語と
 * 出ていく先はドロワーへ移る (SiteMenu)。
 *
 * 見張るのは、同じ行き先が 2 つ出ていないこと。帯とドロワーは同じ表を読んでいるので
 * (site-nav.tsx)、片方だけを直して二重になる回帰 (#154) はここに出る。
 */
export const SolidNarrow: Story = {
  args: {
    variant: "solid",
  },
  globals: {
    viewport: { value: "mobile1", isRotated: false },
  },
};

/*
 * ナビ・検索・表示言語・出ていく先が一列に収まる幅の姿。
 *
 * 境目は lg (1024px)。Storybook の既定 (responsive) では iframe の幅次第で
 * 畳まれることがあるので、広い幅を明示しておく。
 */
export const SolidWide: Story = {
  args: {
    variant: "solid",
  },
  globals: {
    viewport: { value: "desktop", isRotated: false },
  },
};

/* 下層ページでロゴを伏せる使い方は今のところ無いが、変種の組み合わせとして見られるように。 */
export const SolidWithoutLogo: Story = {
  args: {
    variant: "solid",
    showLogo: false,
  },
};
