import { LinkCardsContext } from "./link-card-context";
import { LinkCardSlot } from "./link-card-slot";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { LinkCardView } from "~/backend/handlers/link-cards/link-card-view";

/*
 * 画像は data: URI で自足させる。本番のカードは自分のところ (`/api/v1/link-cards/...`)
 * から配るので、Storybook では実在しない。外の絵を指すと本番の CSP (`img-src 'self' data:`)
 * では出ないものを見て確かめたことになる (link-card.stories.tsx と同じ)。
 */
const thumbnail =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='630'><rect width='1200' height='630' fill='%232b4a76'/><text x='600' y='350' font-size='96' fill='white' text-anchor='middle' font-family='sans-serif'>OGP</text></svg>";

const favicon =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><circle cx='8' cy='8' r='8' fill='%23c9ab80'/></svg>";

const cardUrl = "https://example.com/article";

const card: LinkCardView = {
  url: cardUrl,
  title: "むき出しの URL を OGP のリンクカードにする",
  description:
    "段落がリンク 1 つだけでできているとき、リンク先の OGP を読んでカードとして描く。",
  siteName: "example",
  imageUrl: thumbnail,
  faviconUrl: favicon,
};

/*
 * 印のついた要素を実際のカードにする。中身が見つからないときは素のリンクに戻す
 * (カードにできなかっただけで本文から URL が消えるのは、静かに壊れているのと変わらない)。
 */
const meta: Meta<typeof LinkCardSlot> = {
  title: "Mdast/LinkCardSlot",
  component: LinkCardSlot,
  args: { url: cardUrl },
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

/** 表に中身がある場合。カードとして描く。 */
export const Found: Story = {
  decorators: [
    (Story) => (
      <LinkCardsContext value={new Map([[cardUrl, card]])}>
        <Story />
      </LinkCardsContext>
    ),
  ],
};

/** 表に無い場合。素のリンクに戻す。 */
export const Missing: Story = {};

/** http(s) でない URL。href を渡さず、文字列だけを出す。 */
export const NotHttp: Story = {
  args: { url: "javascript:alert(1)" },
};
