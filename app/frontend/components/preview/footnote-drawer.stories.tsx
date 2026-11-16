import { FootnoteDrawer } from "./footnote-drawer";
import type { Meta, StoryObj } from "@storybook/react-vite";

/*
 * タッチで脚注を読むためのドロワー。描かれた時点で開く。
 *
 * 閉じ方は 4 つ (背景を押す・下に払う・閉じるボタン・Esc)。記事では閉じると要素ごと
 * 外れるが、ここでは持ち主が居ないので、閉じたあとは何も出ない (描き直すと出る)。
 */
const meta: Meta<typeof FootnoteDrawer> = {
  title: "Preview/FootnoteDrawer",
  component: FootnoteDrawer,
  args: { onClose: () => {} },
  globals: { viewport: { value: "mobile1" } },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    children: (
      <div className="preview-footnote mdast-prose prose max-w-none">
        <p>
          脚注の中身。<strong>装飾</strong>も<a href="https://example.com">リンク</a>も、
          本文と同じ描き方で出る。
        </p>
      </div>
    ),
  },
};

/** 長い脚注。高さには上限があり、中で巻く。巻いている途中の指は、払ったことにしない。 */
export const Long: Story = {
  args: {
    children: (
      <div className="preview-footnote mdast-prose prose max-w-none">
        {Array.from({ length: 16 }, (_, index) => (
          <p key={index}>長い脚注の {index + 1} 段落目。ドロワーは伸び続けず、中で巻く。</p>
        ))}
      </div>
    ),
  },
};
