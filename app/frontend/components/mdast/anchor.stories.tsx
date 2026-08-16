import { Anchor } from "./anchor";
import type { Meta, StoryObj } from "@storybook/react-vite";

/*
 * ページ内アンカーだけ React Router の Link に通す。素の <a href="#..."> だと
 * <ScrollRestoration> がハッシュジャンプを打ち消してスクロールしない (#268)。
 *
 * 見た目は素のリンクと変わらないので、ここで見るのは「壊れていないこと」まで。
 */
const meta: Meta<typeof Anchor> = {
  title: "Mdast/Anchor",
  component: Anchor,
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

/** ページ内アンカー。Link を通る。 */
export const InPage: Story = {
  args: { href: "#user-content-fn-1", children: "脚注へ" },
};

/** 外部リンク。素の <a> のまま。 */
export const External: Story = {
  args: { href: "https://example.com/", children: "よそのページ" },
};

/*
 * 行き先を持たないリンク。
 *
 * 本文の MDAST からは起きないが、`components` の表に登録した以上どんな props でも
 * 描けなければならない。**カードに戻せなかった URL はここを通らない**
 * (LinkCardSlot が素の `<a>` を返し、toJsxRuntime の表を通らないため)。
 */
export const WithoutHref: Story = {
  args: { children: "行き先なし" },
};
