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

  // プロフィール。中身はコンテンツリポジトリの `profile.md` から来る (ADR 0041)。
  route("about", "routes/about.tsx"),

  // 作ったもの。中身はコンテンツリポジトリの `works/<slug>.md` から来る (ADR 0042)。
  // フィードは持たない (作ったものは購読するものではない)。
  route("works", "routes/works.tsx"),
  route("works/:slug", "routes/works.$slug.tsx"),

  /*
   * ヘッダーのナビが指している、まだ中身の無い 2 つ。
   *
   * 「準備中」の一文だけを置いてある。ナビに並べておきながら 404 に落とすと、
   * サイトが壊れているように見えるため。中身が入るのは #412 / #415。
   */
  route("notes", "routes/notes.tsx"),
  route("slides", "routes/slides.tsx"),

  // 絵文字と書体の帰属を置く場所。フッターのリンクから辿る。
  route("licenses", "routes/licenses.tsx"),

  /*
   * ログイン (ADR 0039)。**ナビには出さない。**
   *
   * 受け口 (POST /sign-in、GET /sign-in/callback、POST /sign-in/confirm、
   * POST /sign-out) は Hono 側が先に応答するので、ここには現れない。
   */
  route("sign-in", "routes/sign-in.tsx"),
  route("sign-in/sent", "routes/sign-in.sent.tsx"),
  route("sign-in/confirm", "routes/sign-in.confirm.tsx"),
] satisfies RouteConfig;
