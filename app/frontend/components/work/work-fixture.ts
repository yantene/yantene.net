import type { PublicWork } from "~/backend/handlers/works/work-view";

/** stories が共有する作品の見本。`.ts` なので stories は要らない。 */
export const sampleWorks: readonly PublicWork[] = [
  {
    slug: "infoholick",
    name: "infoholick",
    summary: "読んだものを覚えておくやつ。",
    url: "https://github.com/yantene/infoholick",
  },
  {
    slug: "openapi-sorbet-rails",
    name: "openapi-sorbet-rails",
    summary: "OpenAPI の定義から Sorbet の型を起こす gem。",
    url: "https://github.com/yantene/openapi-sorbet-rails",
  },
  {
    slug: "arerd",
    name: "arerd",
    summary: "「あれ」で呼び出すランチャ。まだ外には出していない。",
    url: null,
  },
];
