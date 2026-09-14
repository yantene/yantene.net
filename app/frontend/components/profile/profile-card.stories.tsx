import { ProfileCard } from "./profile-card";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { PublicProfile } from "~/backend/handlers/profile/profile-view";

const profile: PublicProfile = {
  name: "吉田 周平 (Shuhei YOSHIDA)",
  dateOfBirth: "1993-11-18",
  birthplace: "愛知県刈谷市",
  tagline: [
    "自由ソフトウェア主義者ワナビを経て、今は一介のコンピュータ好き。",
    "東京の目黒川のほとりで Web 開発をしている。",
    "ラップトップと、おいしいごはんがあって、",
    "あとは大切な人たちがいればだいたい幸せ。",
  ].join("\n"),
  socials: [
    { platform: "github", url: "https://github.com/yantene", isMe: true },
    { platform: "x", url: "https://x.com/yantene", isMe: true },
    { platform: "bluesky", url: "https://bsky.app/profile/yantene.net", isMe: true },
    { platform: "mastodon", url: "https://mastodon.social/@yantene", isMe: true },
    { platform: "discord", url: "https://discord.com/users/yantene", isMe: false },
  ],
};

const meta: Meta<typeof ProfileCard> = {
  title: "Profile/ProfileCard",
  component: ProfileCard,
};

export default meta;
type Story = StoryObj<typeof meta>;

/** `/about` の頭に出る姿。 */
export const Default: Story = {
  args: { profile },
};

/**
 * 出身地を書かなかったとき。欄ごと消える (空の値を置かない)。
 */
export const WithoutBirthplace: Story = {
  args: { profile: { ...profile, birthplace: null } },
};

/**
 * 出ていく先がまだ 1 つも無いとき。並びごと消える。
 */
export const WithoutSocials: Story = {
  args: { profile: { ...profile, socials: [] } },
};

/**
 * 短い自己紹介が 1 行のとき。行で折る作りが、1 行でも崩れないことを見る。
 */
export const SingleLineTagline: Story = {
  args: { profile: { ...profile, tagline: "東京で Web 開発をしている。" } },
};
