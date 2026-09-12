import { userEvent, within } from "storybook/test";
import { CommandPalette } from "./command-palette";
import type { SearchArticles, SearchResult } from "./search-results";
import type { Meta, StoryObj } from "@storybook/react-vite";

const sampleResults: readonly SearchResult[] = [
  {
    slug: "install-arch-linux-on-vaio-pro",
    title: "UEFI 機に Arch Linux を入れる",
    summary:
      "VAIO Pro 13 に Arch Linux を入れたときの手順。UEFI と Secure Boot の付き合い方から書く。",
  },
  {
    slug: "hacku-2016",
    title: "オートマチック・オタク・マッチング ― Hack U 2016 名古屋会場に参加しました",
    summary: "2 日でオタク同士を引き合わせる仕組みを作った話。",
  },
  {
    slug: "comb-sort-in-java",
    title: "コムソートを Java で書く",
    summary: "バブルソートの比較の幅を縮めていくだけで、ここまで速くなる。",
  },
];

/*
 * 取り方はモジュールに置いて固定する。
 *
 * 引数に無名関数をその場で書くと、描画のたびに別物になって検索が投げ直され続ける
 * (command-palette.tsx の `search` の注意)。
 */
const findSample: SearchArticles = (query) =>
  Promise.resolve(
    sampleResults.filter((result) =>
      // 題でだけ絞る。ここで見たいのは検索の精度ではなく、結果の並びと選び方。
      result.title.toLowerCase().includes(query.toLowerCase()),
    ),
  );

const findNothing: SearchArticles = () => Promise.resolve([]);
const neverSettle: SearchArticles = () => new Promise(() => undefined);
const alwaysFail: SearchArticles = () => Promise.reject(new Error("boom"));

/**
 * 入力欄に字を打つ play を組む。
 *
 * `<dialog>` を modal で開くと最前面 (top layer) に出て canvas の外に居るので、
 * `within(canvasElement)` では辿れない。書き出し先の document 全体から探す。
 */
function typeQuery(query: string): () => Promise<void> {
  return async () => {
    const input = await within(document.body).findByRole("combobox");
    await userEvent.type(input, query);
  };
}

const meta: Meta<typeof CommandPalette> = {
  title: "Search/CommandPalette",
  component: CommandPalette,
  parameters: {
    layout: "fullscreen",
  },
  args: {
    open: true,
    onClose: () => undefined,
    search: findSample,
  },
  decorators: [
    (Story) => (
      <div className="h-96 bg-base-200 p-6">
        <p className="text-sm text-base-content/60">
          後ろのページ。暗がりの濃さと、字が透けないことをここで見る。
        </p>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/*
 * 開いた直後。まだ何も打っていないので、何を探せる場所なのかだけを出す。
 *
 * 結果を並べた姿は、この画面で字を打てば見られる (Storybook でも検索は動く)。
 */
export const Empty: Story = {};

/* 打っている最中。結果が返る前の姿。 */
export const Searching: Story = {
  args: { search: neverSettle },
  play: typeQuery("arch"),
};

/* 一致しなかったとき。足元のリンクから一覧へ送り出せることを確かめる。 */
export const NoMatch: Story = {
  args: { search: findNothing },
  play: typeQuery("みつからない語"),
};

/* 取りに行けなかったとき。素のリンクに落ちるのではなく、失敗したことを出す。 */
export const Failed: Story = {
  args: { search: alwaysFail },
  play: typeQuery("arch"),
};
