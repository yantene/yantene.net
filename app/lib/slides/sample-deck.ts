/*
 * 見本のデッキ。意味の語彙を 1 回ずつ使ってある。
 *
 * テスト・stories・手元での確認が同じものを使う。片方だけ書き換わると、「stories では
 * 出ているのにテストは古い形を見ている」状態になる。**語彙を足したら、ここにも足す。**
 */
export const SAMPLE_SLIDE_MARKDOWN = `---
title: Workers で作る個人サイト
publishedOn: 2026-12-10
event:
  name: Cloudflare Meetup Tokyo
  date: 2026-12-10
  url: https://example.com/events/1
---

今日は、個人サイトを Workers の上に作り直した話をします。

# 動機

なぜ作り直したのか、から始めます。

## なぜ自作するのか

- 自己表現の場
- 新しい技術の遊び場
- **細部**にこだわりたい

ブログサービスでもよかったんですが、細部にこだわりたかったので自作しました。

## 自分の言葉を、自分の場所から

# 構成

## 全体像

![Hono と React Router と D1 の関係を表した構成図](/icons/profile.svg "構成図")

- Hono が API を受ける
- React Router が描く

## 同期の流れ

1. Markdown を書く
2. \`git push\` する
3. D1 と R2 に載る

. . .

> [!WARNING]
> 同期は同時に 2 つ走らない

## 置き場所の比較

| 置き場所 | 持つもの       | 速さ |
| -------- | -------------- | ---- |
| D1       | メタデータ     | 速い |
| R2       | 本文と画像     | 速い |
| Artifacts | 原文          | 遅い |

## 設計の拠り所

> 依存は常に内側へ向ける。[^clean]

## 入口のコード

\`\`\`ts
export default {
  fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
};
\`\`\`

エントリポイントは Hono の fetch をそのまま出すだけです。

## 人気順の重み

$$
w(d) = 2^{(d - d_0) / h}
$$

## ご清聴ありがとうございました

[^clean]: Robert C. Martin『Clean Architecture』
`;
