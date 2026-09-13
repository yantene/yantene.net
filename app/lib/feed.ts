/**
 * フィードの名乗り。フィード本体 (backend/handlers/feed.handler) と、ページの
 * `<link rel="alternate">`、ヘッダーの選び場所 (frontend/components/feed) が
 * ここから引く。
 *
 * 別々に組み立てると、リーダーに見える名前と実際のフィードの `<title>` がずれる。
 * リーダーは title で購読先を見分けるので、ずれた時点で「同じ名前の別フィード」に
 * 見えてしまう。フロント・バック共通のここを唯一の出どころにする。
 *
 * 種別で分けた理由と、行き先を `/feed/` の下に置いた理由は
 * docs/adr/0038-split-feeds-by-content-kind.md にある。
 */

const FEED_TITLE = "やんてね";
/* i18n の meta.description と同じ一文。リーダーに出る名乗りなので、サイトの説明と
 * 食い違わせない。ja.json を書き換えたらここも合わせること (あちらは React の外から
 * 引けないので、同じ文字列を二度持つしかない)。 */
const FEED_SUBTITLE = "Web の向こうから。エッセイ、技術記事、つくったもの。";

/**
 * フィードの種別。サイトの行き先 (ナビ) と 1 対 1 で対応させ、`all` がその全部を束ねる。
 *
 * **`notes` と `slides` はまだ中身が無い** (#412 / #415)。それでもフィードとしては
 * 実在させ、entry 0 件の Atom を返す。ナビが行き先を先に見せているのと同じ理屈で、
 * いま購読しておけば中身が入った時点で届く。後から URL を生やすと、その時点で
 * 購読している人が誰もいない状態から始まる。
 */
export type FeedKind = "all" | "articles" | "notes" | "slides";

export interface FeedIdentity {
  readonly kind: FeedKind;
  readonly title: string;
  readonly subtitle: string;
  /** フィード自身のパス (Atom の rel=self、ページの rel=alternate)。 */
  readonly path: string;
  /** 対応する HTML ページのパス。Atom の id もこれを使う。 */
  readonly alternatePath: string;
  /**
   * 選び場所に出す名前の翻訳キー。**字は日英どちらでも英語のまま** (場所の名前は
   * 訳さない。app/lib/i18n/locales/locales.test.ts に線引きがある)。
   *
   * ナビと同じキーを引く。ここに `"Articles"` と直書きすると、ナビの字と 2 か所で
   * 持つことになる。
   */
  readonly labelKey: string;
}

/**
 * フィードの一覧。**並びはヘッダーの選び場所にそのまま出る順。**
 *
 * `all` を先頭に置き、以下はナビと同じ順にする。どれか 1 つだけを購読する人より、
 * まず全部を購読する人のほうが多い。
 *
 * ⚠️ **種別ごとのフィードは `/feed/` の下に置くこと。`/articles/feed.xml` にしない。**
 * 記事の原文 Markdown が `/articles/:file` で登録されている
 * (backend/handlers/articles/markdown.handler)。同じ位置に静的なパスを足すと、Hono の
 * SmartRouter が RegExpRouter を諦めて TrieRouter に落ち、**アプリ全体のリクエストが
 * 遅いマッチャーを通る**。登録の順を入れ替えても直らない (静的が先でも後でも落ちる)。
 * `markdown.handler.test.ts` の「keeps the whole app on the faster router」が見張っている。
 *
 * **`/feed.xml` (全体) は動かさない。** 既に購読されている URL なので、動かすとリーダーの
 * 手元で購読が切れる。種別ごとのぶんだけを新しく `/feed/` の下に生やす。
 */
export const feedIdentities: readonly FeedIdentity[] = [
  {
    kind: "all",
    title: FEED_TITLE,
    subtitle: FEED_SUBTITLE,
    path: "/feed.xml",
    alternatePath: "/",
    labelKey: "feed.all",
  },
  {
    kind: "articles",
    title: `${FEED_TITLE} — Articles`,
    /* i18n の articles.lead と同じ一文 (一覧の見出しに続く字)。翻訳リソースは React の
     * 外から引けないので、同じ文字列を二度持つしかない。ja.json を書き換えたらここも
     * 合わせること。FEED_SUBTITLE と meta.description の関係と同じ。 */
    subtitle: "エッセイ、技術記事、その他もろもろ。長めに書きたいことはここに置いている。",
    path: "/feed/articles.xml",
    alternatePath: "/articles",
    labelKey: "navigation.articles",
  },
  {
    kind: "notes",
    title: `${FEED_TITLE} — Notes`,
    subtitle: "題を付けるほどでもない、短い投稿。",
    path: "/feed/notes.xml",
    alternatePath: "/notes",
    labelKey: "navigation.notes",
  },
  {
    kind: "slides",
    title: `${FEED_TITLE} — Slides`,
    subtitle: "発表で使ったスライドと、発表しなかったスライド。",
    path: "/feed/slides.xml",
    alternatePath: "/slides",
    labelKey: "navigation.slides",
  },
];

/**
 * 種別からフィードの名乗りを引く。
 *
 * 種別は型で閉じているので見つからないことはないが、型を跨いで呼ばれたときに
 * 静かに壊れないよう投げる (fail-loud)。
 */
export function feedIdentity(kind: FeedKind): FeedIdentity {
  const identity = feedIdentities.find((candidate) => candidate.kind === kind);
  if (identity === undefined) throw new Error(`unknown feed kind: ${kind}`);
  return identity;
}
