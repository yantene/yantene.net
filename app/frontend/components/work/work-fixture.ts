import type { PublicWork, PublicWorkScreenshot } from "~/backend/handlers/works/work-view";

/** stories が共有するスクリーンショットの見本。横長 2 枚と縦長 1 枚。 */
export const sampleScreenshots: readonly PublicWorkScreenshot[] = [
  {
    src: "https://picsum.photos/seed/yantene-top/1600/900",
    alt: "新着記事が要約つきで並ぶトップ画面",
    kind: "desktop",
    width: 1600,
    height: 900,
  },
  {
    src: "https://picsum.photos/seed/yantene-reader/450/950",
    alt: "スマートフォンで記事を開いた画面",
    kind: "mobile",
    width: 450,
    height: 950,
  },
  {
    src: "https://picsum.photos/seed/yantene-settings/1600/900",
    alt: "購読するフィードを選ぶ設定画面",
    kind: "desktop",
    width: 1600,
    height: 900,
  },
];

/** 書いていない欄の姿。足した欄はどれも省略できる。 */
const blank = {
  stack: [],
  period: null,
  role: null,
  featured: false,
  screenshots: [],
  language: "ja",
} as const satisfies Partial<PublicWork>;

/** stories が共有する作品の見本。`.ts` なので stories は要らない。 */
export const sampleWorks: readonly PublicWork[] = [
  {
    slug: "infoholick",
    name: "infoholick",
    summary: "読んだものを覚えておくやつ。",
    url: "https://github.com/yantene/infoholick",
    stack: ["TypeScript", "Cloudflare Workers", "Hono"],
    period: { from: "2024", until: "2025" },
    role: "設計から運用まで 1 人で担当",
    featured: true,
    screenshots: sampleScreenshots,
    language: "ja",
  },
  {
    ...blank,
    slug: "openapi-sorbet-rails",
    name: "openapi-sorbet-rails",
    summary: "OpenAPI の定義から Sorbet の型を起こす gem。",
    url: "https://github.com/yantene/openapi-sorbet-rails",
  },
  {
    ...blank,
    slug: "arerd",
    name: "arerd",
    summary: "「あれ」で呼び出すランチャ。まだ外には出していない。",
    url: null,
  },
];
