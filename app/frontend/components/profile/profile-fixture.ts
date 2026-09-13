import type { PublicLifeEvent, PublicProfile } from "~/backend/handlers/profile/profile-view";

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
  avatarUrl: "/api/v1/profile/assets/avatar.png",
  socials: [
    { platform: "github", url: "https://github.com/yantene", isMe: true },
    { platform: "x", url: "https://x.com/yantene", isMe: false },
    { platform: "bluesky", url: "https://bsky.app/profile/yantene.net", isMe: true },
    { platform: "mastodon", url: "https://mastodon.social/@yantene", isMe: true },
    { platform: "discord", url: "https://discord.com/users/yantene", isMe: false },
  ],
};

/** 3 つの粒度 (日・月・年) が並ぶ見本。表示の出し分けを確かめられる。 */
export const sampleLifeEvents: readonly PublicLifeEvent[] = [
  {
    date: "1993-11-18",
    precision: "day",
    kind: "birth",
    title: "生誕",
    description: "世界の世知辛さに泣きわめく。",
  },
  {
    date: "2012-04",
    precision: "month",
    kind: "school-entry",
    title: "大学入学",
    description: null,
  },
  {
    date: "2016",
    precision: "year",
    kind: "employment",
    title: "就職",
    description: "Web 開発者になる。",
  },
];
