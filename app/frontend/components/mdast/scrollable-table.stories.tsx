import { ScrollableTable } from "./scrollable-table";
import type { Meta, StoryObj } from "@storybook/react-vite";

/*
 * 本文の表を収める器。幅は記事ページの本文と同じ 768px (max-w-3xl) の prose の中で
 * 見る (embed-frame.stories.tsx と同じ)。はみ出す表だけが器の中で横に送れる。
 */
const meta: Meta<typeof ScrollableTable> = {
  title: "Mdast/ScrollableTable",
  component: ScrollableTable,
  decorators: [
    (Story) => (
      <div className="p-6">
        <div className="mdast-prose prose max-w-3xl">
          <Story />
        </div>
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** 幅に収まる表。器は見た目に何も足さない。 */
export const Fits: Story = {
  args: {
    children: (
      <>
        <thead>
          <tr>
            <th>環境</th>
            <th>内部リンク</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>ホバーできる</td>
            <td>チップ</td>
          </tr>
          <tr>
            <td>タッチ</td>
            <td>素のリンク</td>
          </tr>
        </tbody>
      </>
    ),
  },
};

const columns = [
  "status",
  "一覧",
  "フィード",
  "sitemap",
  "検索",
  "関連記事",
  "人気順",
  "URL 直打ち",
  "管理者",
] as const;

/** 列の多い表。器の中で横に送れる。見出しの字は 1 行に保つ。 */
export const Overflows: Story = {
  args: {
    children: (
      <>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {["published", "unlisted", "withdrawn"].map((status) => (
            <tr key={status}>
              {columns.map((column, index) => (
                <td key={column}>{index === 0 ? status : "出ない"}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </>
    ),
  },
};
