import { NoteBranches } from "./note-branches";
import type { Meta, StoryObj } from "@storybook/react-vite";

const notes = [
  {
    slug: "use-tutvpn-wisely",
    title: "ocproxy で TUT VPN を賢く使う",
    summary:
      "この記事は TUT Advent Calendar 2016 の 9 日目の記事です。みなさん、技科大の VPN を使ってますか。",
    publishedOn: "2016-12-09",
  },
  {
    slug: "tut-tani-checker",
    title: "技科大の成績確認ツールを作ってみた",
    summary:
      "豊橋技科大では、明日 (8 月 28 日) の午前 9 時より今年度前期の成績発表が行われます。",
    publishedOn: "2015-08-27",
  },
  {
    slug: "install-arch-linux-on-uefi-machine",
    title: "Arch Linux on UEFI な環境のインストール手順の備忘録",
    summary:
      "もうすぐ(既に？)年末ですね。年末は何かと忙しくなりますよね。だったら暇で退屈なクリスマスのうちに面倒ごとは済ませておきたいですよね！！！",
    publishedOn: "2014-12-25",
  },
];

const meta: Meta<typeof NoteBranches> = {
  title: "NoteBranches/NoteBranches",
  component: NoteBranches,
  args: { notes },
  decorators: [
    // 記事の本文と同じ幅で見る。
    (Story) => (
      <div className="w-full max-w-3xl px-6">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 1 件だけのとき。幹は枝の高さで止まる。 */
export const SingleBranch: Story = {
  args: { notes: notes.slice(0, 1) },
};

/** 表題が長いと折り返り、要約は 1 行で切れる。 */
export const LongTitles: Story = {
  args: {
    notes: notes.map((note, index) => ({
      ...note,
      slug: `long-${String(index)}`,
      title: `${note.title} ― さらに長い副題が続く場合にどこで折り返るか`,
    })),
  },
};

/** 記事が多いとき。幹が伸び、枝が等間隔に並ぶ。 */
export const ManyBranches: Story = {
  args: {
    notes: Array.from({ length: 6 }, (_, index) => ({
      ...notes[index % notes.length],
      slug: `many-${String(index)}`,
    })),
  },
};
