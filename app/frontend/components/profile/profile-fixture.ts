import type { PublicHistoryChapter, PublicProfile } from "~/backend/handlers/profile/profile-view";

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
  socials: [
    { platform: "github", url: "https://github.com/yantene", isMe: true },
    { platform: "x", url: "https://x.com/yantene", isMe: false },
    { platform: "bluesky", url: "https://bsky.app/profile/yantene.net", isMe: true },
    { platform: "mastodon", url: "https://mastodon.social/@yantene", isMe: true },
    { platform: "discord", url: "https://discord.com/users/yantene", isMe: false },
    /*
     * メール。**`mailto:` なのはここだけ**で、描く側の扱いも他と違う
     * (別タブで開かない・`u-email` を名乗る)。見本にも入れておかないと、
     * stories でもテストでもその分岐が一度も通らない。
     */
    { platform: "email", url: "mailto:contact@example.com", isMe: true },
  ],
};

/*
 * 見本の経歴。
 *
 * 出来事の 3 つの姿を 1 つずつ入れてある (素の行・リンクの付いた行・補足の付いた行)。
 * どれかが欠けると、stories でもテストでもその分岐が一度も通らない。章を 2 つにして
 * いるのは、縦線が章をまたいで続くことを見るため (1 章だと端の判定しか働かない)。
 */
export const sampleHistory: readonly PublicHistoryChapter[] = [
  {
    chapter: "高校",
    entries: [
      {
        year: 2011,
        text: "第 28 回 全国高等学校情報処理競技大会 愛知県予選会 個人優勝",
        url: null,
        note: null,
      },
      { year: 2012, text: "愛知県立知立高等学校 情報処理科 卒業", url: null, note: null },
    ],
  },
  {
    chapter: "大学",
    entries: [
      {
        year: 2012,
        text: "豊橋技術科学大学 工学部 情報・知能工学課程 入学",
        url: null,
        note: null,
      },
      {
        year: 2012,
        text: "セキュリティ・キャンプ中央大会 2012 Web・セキュリティ・クラス",
        url: "https://www.youtube.com/watch?v=Ki1qb9q4z8E",
        note: "CTF チーム優勝 (チーム名: `|`、6424 points)",
      },
      { year: 2018, text: "豊橋技術科学大学大学院 工学研究科 修了", url: null, note: null },
    ],
  },
];
