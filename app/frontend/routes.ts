import { type RouteConfig, index, route } from "@react-router/dev/routes";

/*
 * ページのルーティング定義。JSON API・フィード・OG 画像・sitemap・認証フローは
 * Hono 側 (app/backend/index.ts) が先に応答するため、ここには現れない。
 */
export default [
  index("routes/home.tsx"),

  route("notes", "routes/notes.tsx"),
  route("notes/:slug", "routes/notes.$slug.tsx"),
  route("series/:slug", "routes/series.$slug.tsx"),

  // ログインは現状休眠 (将来の有料記事用に温存)。
  route("login", "routes/login.tsx"),
  route("login/sent", "routes/login-sent.tsx"),
] satisfies RouteConfig;
