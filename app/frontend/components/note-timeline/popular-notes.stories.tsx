import { PopularNotes } from "./popular-notes";
import type { Meta, StoryObj } from "@storybook/react-vite";

const notes = [
  {
    slug: "install-arch-linux-on-uefi-machine",
    title: "Arch Linux on UEFI な環境のインストール手順の備忘録",
    summary: "",
    imageUrl: null,
    publishedOn: "2014-12-25",
  },
  {
    slug: "use-tutvpn-wisely",
    title: "ocproxy で TUT VPN を賢く使う",
    summary: "",
    imageUrl: null,
    publishedOn: "2016-12-09",
  },
  {
    slug: "tut-photographs",
    title: "技科大写真で振り返る 4 年間",
    summary: "",
    imageUrl: null,
    publishedOn: "2015-12-02",
  },
  {
    slug: "hacku-2016",
    title:
      "オートマチック・オタク・マッチング ― Hack U 2016 名古屋会場に参加しました",
    summary: "",
    imageUrl: null,
    publishedOn: "2016-09-26",
  },
];

const meta: Meta<typeof PopularNotes> = {
  title: "NoteTimeline/PopularNotes",
  component: PopularNotes,
  args: { notes },
  decorators: [
    // ホームでは本文の脇に立つ細い柱なので、その幅で見る。
    (Story) => (
      <div className="w-60">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** 表題が長いと折り返る。番号の列は折り返しても動かない。 */
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
