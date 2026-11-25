import { PreviewLayer } from "./preview-layer";
import type { ArticlePreviewLoader } from "./preview-layer";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ArticleLink } from "~/frontend/components/mdast/article-link";
import { FootnoteReference } from "~/frontend/components/mdast/footnote-reference";

/*
 * 本文の内部リンクと脚注の参照に出すプレビュー。**触って確かめる場所。**
 *
 * - マウスでリンクに乗せて 0.3 秒ほど待つと、チップが出る。通り過ぎるだけでは出ない
 * - カーソルをチップへ移しても閉じない。離れるとすぐ閉じる。Esc でも閉じる
 * - Tab で焦点を当てても出る
 * - タッチ (DevTools の端末エミュレーション) では、内部リンクは素のリンクのまま。
 *   脚注の番号を押すとドロワーが出る。背景を押すか、下に払うと閉じる
 *
 * プレビュー API は Storybook に居ないので、取り方を差し替えてある。
 */
const loadArticlePreview: ArticlePreviewLoader = (slug) =>
  Promise.resolve(
    slug === "hidden"
      ? null
      : {
          slug,
          title: "Popover API と CSS anchor positioning で作るチップ",
          summary:
            "位置合わせを JavaScript から CSS へ移すと、スクロールにもリサイズにも勝手に付いてくる。inline style を書かない規約とも相性がよい。その代わり、対応していないブラウザでの倒し方を先に決めておく必要がある。",
          publishedOn: "2026-11-16",
          imageUrl: null,
          language: "ja",
        },
  );

const footnotes = new Map<string, React.ReactNode>([
  [
    "user-content-fn-1",
    <p key="1">
      一つ目の注。<strong>装飾</strong>も<a href="https://example.com">リンク</a>も置ける。
    </p>,
  ],
  [
    "user-content-fn-2",
    <div key="2">
      <p>二つ目の注は長い。段落が複数あっても、本文と同じ組版で出る。</p>
      <p>
        長い注はチップの中で巻く。巻き終わりで後ろの本文まで引きずらない。
        読み進めたい人の邪魔にならないよう、離れたらすぐ閉じる。
      </p>
    </div>,
  ],
]);

const meta: Meta<typeof PreviewLayer> = {
  title: "Preview/PreviewLayer",
  component: PreviewLayer,
  args: { footnotes, loadArticlePreview },
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

const body = (
  <>
    <p>
      本文の途中で注を付ける
      <sup>
        <FootnoteReference href="#user-content-fn-1" id="user-content-fnref-1">
          1
        </FootnoteReference>
      </sup>
      。別の記事への
      <ArticleLink href="/articles/popover-chip" slug="popover-chip" className="press-control">
        内部リンク
      </ArticleLink>
      もある。長い注
      <sup>
        <FootnoteReference href="#user-content-fn-2" id="user-content-fnref-2">
          2
        </FootnoteReference>
      </sup>
      と、読み手には見えない記事への
      <ArticleLink href="/articles/hidden" slug="hidden" className="press-control">
        リンク
      </ArticleLink>
      (チップは出ない) も並べてある。
    </p>
    <p>
      行の右端に近いリンクでも、チップは画面からはみ出さない。
      下に収まらないときは上へ回る。ここは幅いっぱいまで字を並べて、右端の様子を見るための段落。
      <ArticleLink href="/articles/right-edge" slug="right-edge" className="press-control">
        右端のリンク
      </ArticleLink>
    </p>
  </>
);

/** 本文の中の引き金。 */
export const Default: Story = {
  args: { children: body },
};

/** 狭い画面。タッチのエミュレーションと合わせて、ドロワーの出方を見る。 */
export const Narrow: Story = {
  args: { children: body },
  globals: { viewport: { value: "mobile1" } },
};
