import { LightboxImage } from "./lightbox-image";
import type { Meta, StoryObj } from "@storybook/react-vite";

/*
 * 押すと拡大する。閉じるのは背景を押すか Esc。
 *
 * 暗幕は createPortal で document.body の下に出るので、Storybook の枠を突き抜けて
 * 画面いっぱいに広がる。それでよい (記事でも同じ出方をする)。
 */
const meta: Meta<typeof LightboxImage> = {
  title: "Mdast/LightboxImage",
  component: LightboxImage,
  args: {
    src: "https://picsum.photos/seed/yantene/800/450",
    alt: "サンプル画像",
    width: 800,
    height: 450,
  },
  /*
   * 本文の中に出るものなので、prose の中で確かめる。幅は記事ページの本文と同じ 768px
   * (max-w-3xl)。**余白は外側に持たせる。** prose 自身に padding を置くと中身が 720px に
   * 痩せて、記事ページ (padding は外の行が持つ) と 48px ずれる (link-card.stories.tsx と同じ)。
   */
  decorators: [
    (Story) => (
      <div className="p-6">
        <div className="note-prose prose max-w-3xl">
          <Story />
        </div>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** alt を持たない画像。装飾として読み上げから外れる。 */
export const WithoutAlt: Story = {
  args: { alt: undefined },
};

/** 縦長の画像。器の幅に合わせて縮む。 */
export const Portrait: Story = {
  args: {
    src: "https://picsum.photos/seed/tall/450/800",
    width: 450,
    height: 800,
  },
};
