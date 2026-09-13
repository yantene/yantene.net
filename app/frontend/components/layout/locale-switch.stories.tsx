import { LocaleSwitch } from "./locale-switch";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof LocaleSwitch> = {
  title: "Layout/LocaleSwitch",
  component: LocaleSwitch,
};

export default meta;
type Story = StoryObj<typeof meta>;

/*
 * 既定の姿。
 *
 * Storybook の i18n は `en` で初期化してあるので、ここでは EN が塗られて見える。
 * 押しても切り替わらない (送り先の `POST /locale` は Hono 側にあり、Storybook には
 * 無い)。ここで見るのは、どちらが選ばれているかが形で分かるかどうか。
 */
export const Default: Story = {};

/*
 * 透過ヘッダーに載せた姿。動く空の上でも字が沈まないことを確かめる。
 *
 * **囲みに `site-header-overlay` を着せること。** 選ばれていない側の濃さは
 * `--header-ink-dim` が決めており、透過ヘッダーだけ 62% から 80% に上げてある
 * (header.css)。着せないと、空の上で 4.5:1 を割るほうの姿がここに出る。
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
