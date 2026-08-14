import { Alert } from "./alert";
import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta<typeof Alert> = {
  title: "Mdast/Alert",
  component: Alert,
  /*
   * 本文の中に出るものなので、prose の中で確かめる。幅は記事ページの本文と同じ
   * 768px (max-w-3xl)。前後に段落を置くのは、地の文とどれだけ差が付くかを見るため。
   */
  decorators: [
    (Story) => (
      <div className="p-6">
        <div className="note-prose prose max-w-3xl">
          <p>直前の段落。</p>
          <Story />
          <p>直後の段落。</p>
        </div>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** 読み飛ばしても困らないが、知っておくと話が早い補足。 */
export const Note: Story = {
  args: {
    kind: "note",
    children: <p>画像を紛失しました。ごめんなさい。</p>,
  },
};

/** もっと楽なやり方がある、という助言。 */
export const Tip: Story = {
  args: {
    kind: "tip",
    children: <p>この手順は後半の設定だけでも動きます。</p>,
  },
};

/** 目的を達するために要る情報。 */
export const Important: Story = {
  args: {
    kind: "important",
    children: <p>先に鍵を作っておかないと、次の手順で詰まります。</p>,
  },
};

/** 見落とすと困ること。リンク切れやサービス終了の断りに使う。 */
export const Warning: Story = {
  args: {
    kind: "warning",
    children: (
      <p>
        リンク先はサービスを終えており、ドメインは第三者に再取得されていました。
      </p>
    ),
  },
};

/** 手を出すと壊れる、という警告。 */
export const Caution: Story = {
  args: {
    kind: "caution",
    children: <p>この設定を誤ると端末が起動しなくなります。</p>,
  },
};

/** 中身は段落 1 つに限らない。 */
export const WithMultipleBlocks: Story = {
  args: {
    kind: "note",
    children: (
      <>
        <p>中には段落を複数置ける。</p>
        <p>2 つ目の段落。</p>
        <ul>
          <li>箇条書きも</li>
          <li>置ける</li>
        </ul>
      </>
    ),
  },
};

/** 種別を読めなかったときは note に倒す。 */
export const UnknownKind: Story = {
  args: {
    kind: "hint",
    children: <p>知らない種別が来ても、体裁を保って出す。</p>,
  },
};
