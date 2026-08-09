import { InfiniteNoteTimeline } from "./infinite-note-timeline";
import type { LoadNotePage } from "./infinite-note-timeline";
import type { NoteTimelineItemProps } from "./note-timeline-item";
import type { Meta, StoryObj } from "@storybook/react-vite";

const TOTAL_PAGES = 3;
const PER_PAGE = 4;

function notesFor(page: number): NoteTimelineItemProps[] {
  return Array.from({ length: PER_PAGE }, (_, index) => {
    const nth = (page - 1) * PER_PAGE + index + 1;
    const month = String(((nth - 1) % 12) + 1).padStart(2, "0");
    return {
      slug: `note-${String(nth)}`,
      title: `${String(nth)} 件目のノート`,
      summary:
        "下端に近づくと次のページを取りに行く。ここでは取得の手を差し替えて応答を作っている。",
      imageUrl:
        nth % 3 === 0
          ? null
          : `https://picsum.photos/seed/${String(nth)}/640/400`,
      tags: nth % 2 === 0 ? ["日記"] : ["プログラミング", "備忘録"],
      publishedOn: `2026-${month}-15`,
    };
  });
}

/** 用意した応答を少し待ってから返す。読み込み中の表示が一瞬で消えないように。 */
const stubLoad: LoadNotePage = async (page) => {
  await new Promise((resolve) => {
    setTimeout(resolve, 600);
  });
  return { notes: notesFor(page), totalPages: TOTAL_PAGES };
};

const failingLoad: LoadNotePage = async () => {
  await new Promise((resolve) => {
    setTimeout(resolve, 400);
  });
  throw new Error("network is down");
};

const meta: Meta<typeof InfiniteNoteTimeline> = {
  title: "NoteTimeline/InfiniteNoteTimeline",
  component: InfiniteNoteTimeline,
  args: {
    initialNotes: notesFor(1),
    totalPages: TOTAL_PAGES,
    perPage: PER_PAGE,
    loadPage: stubLoad,
  },
  decorators: [
    (Story) => (
      <div className="w-full max-w-5xl px-6">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** 下までスクロールすると続きが足される。3 ページぶんで終わる。 */
export const Default: Story = {};

/** 続きがない場合。見張りを置かず、終わりであることだけを伝える。 */
export const NothingMore: Story = {
  args: { totalPages: 1 },
};

/** 取りに行けなかった場合。黙って止まらず、もう一度試せるようにする。 */
export const LoadFailed: Story = {
  args: { loadPage: failingLoad },
};
