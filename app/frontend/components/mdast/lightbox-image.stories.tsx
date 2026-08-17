import { LightboxImage } from "./lightbox-image";
import type { Meta, StoryObj } from "@storybook/react-vite";

/*
 * 押すと拡大する。閉じるのは背景を押すか Esc。
 *
 * 暗幕は createPortal で document.body の下に出るので、Storybook の枠を突き抜けて
 * 画面いっぱいに広がる。それでよい (記事でも同じ出方をする)。
 *
 * **焦点の動きはここで確かめる。** Tab で拡大ボタンへ移り、Enter で開くと焦点が暗幕へ
 * 渡ること、開いている間 Tab を押しても後ろの本文へ抜けないこと、Esc で閉じると元の
 * ボタンへ戻ること (#304)。読み上げの名前は ImagesInOneArticle で見るのが早い。
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

/*
 * 図が並ぶ記事。**拡大ボタンの名前が図ごとに違うことを見る。**
 *
 * 包みのボタンに `aria-label="画像を拡大"` だけを置いていた頃は、3 つとも同じ名前に
 * なっていて、書き手の alt がどこにも出なかった (#304)。
 */
export const ImagesInOneArticle: Story = {
  render: () => (
    <>
      <LightboxImage
        src="https://picsum.photos/seed/a/800/450"
        alt="D1 と R2 の関係図"
        width={800}
        height={450}
      />
      <LightboxImage
        src="https://picsum.photos/seed/b/800/450"
        alt="refresh の流れ"
        width={800}
        height={450}
      />
      <LightboxImage
        src="https://picsum.photos/seed/c/800/450"
        alt="カードの状態遷移"
        width={800}
        height={450}
      />
    </>
  ),
};

/** 縦長の画像。器の幅に合わせて縮む。 */
export const Portrait: Story = {
  args: {
    src: "https://picsum.photos/seed/tall/450/800",
    width: 450,
    height: 800,
  },
};
