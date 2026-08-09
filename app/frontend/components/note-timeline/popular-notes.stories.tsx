import { PopularNotes } from "./popular-notes";
import type { Meta, StoryObj } from "@storybook/react-vite";

const notes = [
  {
    slug: "install-arch-linux-on-uefi-machine",
    title: "Arch Linux on UEFI な環境のインストール手順の備忘録",
    summary:
      "もうすぐ(既に？)年末ですね。年末は何かと忙しくなりますよね。だったら暇で退屈なクリスマスのうちに面倒ごとは済ませておきたいですよね！！！",
    tags: ["GNU/Linux", "備忘録"],
    publishedOn: "2014-12-25",
  },
  {
    slug: "use-tutvpn-wisely",
    title: "ocproxy で TUT VPN を賢く使う",
    summary:
      "この記事は TUT Advent Calendar 2016 の 9 日目の記事です。みなさん、技科大の VPN を使ってますか。",
    tags: ["GNU/Linux", "Web"],
    publishedOn: "2016-12-09",
  },
  {
    slug: "tut-photographs",
    title: "技科大写真で振り返る 4 年間",
    summary:
      "この記事は TUT Advent Calendar 2015 の 2 日目の記事です。B4 のみなさま、卒研お疲れ様です。",
    tags: ["日記"],
    publishedOn: "2015-12-02",
  },
  {
    slug: "hacku-2016",
    title:
      "オートマチック・オタク・マッチング ― Hack U 2016 名古屋会場に参加しました",
    summary:
      "先日 9 月 25 日、Yahoo! JAPAN 主催のハッカソン、Hack U の名古屋会場にて作品を発表してきました。",
    tags: ["プログラミング", "参加記", "日記"],
    publishedOn: "2016-09-26",
  },
];

const meta: Meta<typeof PopularNotes> = {
  title: "NoteTimeline/PopularNotes",
  component: PopularNotes,
  args: { notes },
  decorators: [
    // ホームでは本文と同じ幅を使うので、その幅で見る。
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

/** 表題が長いと折り返る。順位の列は折り返しても動かない。 */
export const LongTitles: Story = {
  args: {
    notes: notes.map((note, index) => ({
      ...note,
      slug: `long-${String(index)}`,
      title: `${note.title} ― さらに長い副題がつづく場合の折り返しの様子`,
    })),
  },
};

/** 1 件しかないとき。 */
export const SingleNote: Story = {
  args: { notes: notes.slice(0, 1) },
};
