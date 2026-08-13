import { LinkCard } from "./link-card";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { LinkCardView } from "~/backend/handlers/link-cards/link-card-view";

/*
 * 画像は data: URI で自足させる。本番のカードは自分のところ (`/api/v1/link-cards/...`)
 * から配るので、Storybook では実在しない。
 */
const thumbnail =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='630'><rect width='1200' height='630' fill='%232b4a76'/><text x='600' y='350' font-size='96' fill='white' text-anchor='middle' font-family='sans-serif'>OGP</text></svg>";

const favicon =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16'><circle cx='8' cy='8' r='8' fill='%23c9ab80'/></svg>";

const fullCard: LinkCardView = {
  url: "https://example.com/articles/link-card",
  title: "むき出しの URL を OGP のリンクカードにする",
  description:
    "段落がリンク 1 つだけでできているとき、リンク先の OGP を読んでカードに差し替える。リスト項目の中は対象にしない。",
  siteName: "Example Blog",
  imageUrl: thumbnail,
  faviconUrl: favicon,
};

const meta: Meta<typeof LinkCard> = {
  title: "LinkCard/LinkCard",
  component: LinkCard,
  /*
   * 本文の中に出るものなので、prose の中で確かめる (本文の組版が漏れてこないか)。
   * 幅は記事ページの本文と同じ 768px (max-w-3xl) にする。絵と文字の丈の釣り合いは数 px
   * で決まるので、ここが本物とずれていると確かめたことにならない。
   *
   * 余白は外側に持たせる。prose 自身に padding を置くと中身が 720px に痩せて、
   * 記事ページ (padding は外の行が持つ) と 48px ずれる。
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

/** ひととおり揃っている場合。 */
export const Full: Story = {
  args: { card: fullCard },
};

/** OG 画像が無い場合。文字だけの平たいカードになる。 */
export const WithoutImage: Story = {
  args: { card: { ...fullCard, imageUrl: null } },
};

/** 説明が無い場合。題と出どころだけになる。 */
export const WithoutDescription: Story = {
  args: { card: { ...fullCard, description: null } },
};

/** og:site_name も favicon も無い場合。ホスト名で代える。 */
export const WithoutSiteName: Story = {
  args: { card: { ...fullCard, siteName: null, faviconUrl: null } },
};

/** 題も説明も長い場合。どちらも 2 行で切る。 */
export const LongText: Story = {
  args: {
    card: {
      ...fullCard,
      title:
        "とても長い題がついた記事のページで、カードの丈が伸びて本文の流れを断ち切らないことを確かめるためのもの",
      description:
        "説明も同じように長い。カードは本文の途中に挟まるものなので、丈が読み手の予想を超えないところで切る。切った先は開けば読める。",
    },
  },
};

/** 狭い画面。絵が上に回る。 */
export const Narrow: Story = {
  args: { card: fullCard },
  parameters: { viewport: { defaultViewport: "mobile1" } },
};
