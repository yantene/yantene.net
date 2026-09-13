import { LocaleMenu } from "./locale-menu";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof LocaleMenu> = {
  title: "Layout/LocaleMenu",
  component: LocaleMenu,
  /*
   * 板は押した絵の直下に落ちる (.header-menu が基準を持つ)。Storybook にはヘッダーが
   * 無いので、帯に見立てた囲みを立てて、その中で開かせる。
   */
  decorators: [
    (Story) => (
      <div className="h-64 bg-base-200">
        <div className="flex justify-end bg-white px-6 py-3">
          <Story />
        </div>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/* 畳んだ姿。帯には globe の絵だけが残る。めったに触らない設定なので、これが既定。 */
export const Closed: Story = {};

/*
 * 開いた姿。
 *
 * Storybook の i18n は `en` で初期化してあるので、English に印が付いて見える。押しても
 * 切り替わらない (送り先の `POST /locale` は Hono 側にあり、Storybook には無い)。ここで
 * 見るのは、どちらが選ばれているかが形で分かるかどうか。
 */
export const Open: Story = {
  play: ({ canvasElement }) => {
    canvasElement.querySelector("details")?.setAttribute("open", "");
  },
};

/*
 * 透過ヘッダーに載せた姿。動く空の上でも絵が沈まないことを確かめる。
 *
 * 囲みに `site-header-overlay` を着せること。帯の字の濃さは `--header-ink-dim` が決めて
 * おり、透過ヘッダーだけ 62% から 80% に上げてある (header.css)。
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
