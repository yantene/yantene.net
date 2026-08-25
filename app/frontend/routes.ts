import { type RouteConfig, index, route } from "@react-router/dev/routes";

/*
 * ページのルーティング定義。JSON API・フィード・OG 画像・sitemap は
 * Hono 側 (app/backend/index.ts) が先に応答するため、ここには現れない。
 */
export default [
  index("routes/home.tsx"),

  route("notes", "routes/notes.tsx"),
  route("notes/:slug", "routes/notes.$slug.tsx"),

  // 絵文字と書体の帰属を置く場所。フッターのリンクから辿る。
  route("licenses", "routes/licenses.tsx"),
] satisfies RouteConfig;
