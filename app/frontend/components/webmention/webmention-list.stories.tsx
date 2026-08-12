import { WebmentionList } from "./webmention-list";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { WebmentionView } from "~/backend/handlers/webmentions/webmention-view";

/*
 * アイコンは data: URI で自足させる。本番は自分のところ
 * (`/api/v1/webmentions/avatars/...`) から配るので、Storybook では実在しない。
 */
function avatar(color: string): string {
  return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='64' height='64'><rect width='64' height='64' fill='%23${color}'/></svg>`;
}

function mention(overrides: Partial<WebmentionView>): WebmentionView {
  return {
    id: "1",
    type: "reply",
    source: "https://example.com/posts/1",
    authorName: "だれか",
    authorUrl: "https://example.com/",
    authorAvatarUrl: avatar("2b4a76"),
    content: null,
    publishedAt: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

const meta: Meta<typeof WebmentionList> = {
  title: "Webmention/WebmentionList",
  component: WebmentionList,
  decorators: [
    (Story) => (
      <div className="mx-auto max-w-3xl p-6">
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof meta>;

/** 顔と返信が両方あるとき。 */
export const Mixed: Story = {
  args: {
    webmentions: {
      faces: [
        mention({ id: "f1", type: "like", authorName: "あかり" }),
        mention({
          id: "f2",
          type: "like",
          authorName: "ぼぶ",
          authorAvatarUrl: avatar("c9ab80"),
        }),
        // アイコンが写せなかった人。頭文字で出る。
        mention({
          id: "f3",
          type: "repost",
          authorName: "ちさと",
          authorAvatarUrl: null,
        }),
      ],
      replies: [
        mention({
          id: "r1",
          content:
            "これ、まさに先週ハマったやつだ。unicode-range にキーキャップのぶんで ASCII が入ってるの、言われるまで気づかなかった。",
        }),
        mention({
          id: "r2",
          type: "mention",
          authorName: null,
          authorAvatarUrl: null,
          source: "https://blog.example.net/entry/42",
          content: "関連して、うちでも似たことが起きていた。",
        }),
      ],
    },
  },
};

/** いいねだけ集まったとき。顔だけが並ぶ。 */
export const FacesOnly: Story = {
  args: {
    webmentions: {
      faces: Array.from({ length: 9 }, (_, index) =>
        mention({
          id: `f${String(index)}`,
          type: "like",
          authorName: `ひと${String(index)}`,
          authorAvatarUrl: index % 3 === 0 ? null : avatar("78a2d2"),
        }),
      ),
      replies: [],
    },
  },
};

/** 本文の無い返信。名前と出典だけになる。 */
export const WithoutContent: Story = {
  args: {
    webmentions: {
      faces: [],
      replies: [mention({ id: "r1", content: null })],
    },
  },
};

/** 1 件も無いとき。何も描かない (「まだありません」を置かない)。 */
export const Empty: Story = {
  args: { webmentions: { faces: [], replies: [] } },
};
