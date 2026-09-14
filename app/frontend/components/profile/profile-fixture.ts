import type { PublicProfile } from "~/backend/handlers/profile/profile-view";

/*
 * 見本のプロフィール。
 *
 * stories と microformats2 のテストが同じものを使う。片方だけ書き換わると、
 * 「stories では出ているのにテストは古い形を見ている」状態になる。
 */
export const sampleProfile: PublicProfile = {
  name: "やんてね",
  tagline: [
    "現実に屈しかけている自由ソフトウェア主義者^H^H^H愛好家です。",
    "東京で Web 開発者をやっています。",
  ],
  dateOfBirth: "1993-11-18",
  birthplace: "愛知県刈谷市",
  socials: [
    { platform: "github", url: "https://github.com/yantene", isMe: true },
    { platform: "x", url: "https://x.com/yantene", isMe: false },
    { platform: "bluesky", url: "https://bsky.app/profile/yantene.net", isMe: true },
    { platform: "mastodon", url: "https://mastodon.social/@yantene", isMe: true },
    { platform: "discord", url: "https://discord.com/users/yantene", isMe: false },
  ],
};
