import { SocialLinks } from "./social-links";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { sampleProfile } from "~/frontend/components/profile/profile-fixture";

/*
 * 出ていく先。**出る場所は 3 つで、渡すのは大きさと並べ方だけ。**
 *
 * 絵の色と台は `social-links.css` が持つ。各社のブランド規定で黒 (または白) 以外に
 * 染めることが禁じられているので、置き場所ごとに色を選べる作りにしていない。
 */
const meta: Meta<typeof SocialLinks> = {
  title: "Social/SocialLinks",
  component: SocialLinks,
  /* 出す先はコンテンツリポジトリのプロフィールが持つ。ここでは見本のプロフィールから渡す。 */
  args: { links: sampleProfile.socials },
};

export default meta;
type Story = StoryObj<typeof meta>;

/* ヒーローの中央に並ぶ姿。動く空の上に載る。 */
export const InHero: Story = {
  args: {
    className: "flex items-center gap-3",
    linkClassName: "press-control text-2xl",
  },
};

/* `/about` の名乗りに並ぶ姿。地が白なので台は溶けて見えない。 */
export const InProfileCard: Story = {
  args: {
    className: "flex items-center gap-3",
    linkClassName: "press-control text-2xl",
  },
};

/* 記事末尾の筆者紹介に並ぶ姿。ヒーローより小さく、間も詰める。 */
export const InAuthorNote: Story = {
  args: {
    className: "author-note-socials",
    linkClassName: "author-note-social press-control",
  },
};

/*
 * **台が効いていることを確かめるための姿。**
 *
 * GitHub の猫・Mastodon の m・Discord の目は抜きなので、台が無いと後ろの色がそのまま
 * 入る。濃い地の上に置いて、抜きが地の色ではなく白のままであることを見る。
 *
 * ヒーローの空は 1 日かけて色が変わるので、実物では猫の色が時刻によって変わっていた。
 */
export const OverBusyBackground: Story = {
  args: {
    className: "flex items-center gap-3",
    linkClassName: "press-control text-2xl",
  },
  decorators: [
    (Story) => (
      <div className="rounded-box bg-[linear-gradient(115deg,#283250_0%,#c96a00_45%,#0b7285_100%)] p-8">
        <Story />
      </div>
    ),
  ],
};
