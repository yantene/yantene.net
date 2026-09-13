import { type RouteConfig, index, route } from "@react-router/dev/routes";

/*
 * ページのルーティング定義。JSON API・フィード・OG 画像・sitemap は
 * Hono 側 (app/backend/index.ts) が先に応答するため、ここには現れない。
 */
export default [
  index("routes/home.tsx"),

  // 記事 (長文)。`/notes` は短文の投稿に譲ってある (ADR 0032)。
  route("articles", "routes/articles.tsx"),
  route("articles/:slug", "routes/articles.$slug.tsx"),

  /*
   * ヘッダーのナビが指している、まだ中身の無い 3 つ。
   *
   * 「準備中」の一文だけを置いてある。ナビに並べておきながら 404 に落とすと、
   * サイトが壊れているように見えるため。中身が入るのは #413 / #412 / #415。
   */
  route("about", "routes/about.tsx"),
  route("notes", "routes/notes.tsx"),
  route("slides", "routes/slides.tsx"),

  // 絵文字と書体の帰属を置く場所。フッターのリンクから辿る。
  route("licenses", "routes/licenses.tsx"),
] satisfies RouteConfig;
