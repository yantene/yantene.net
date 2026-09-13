/**
 * 記事の段階と公開範囲 (ADR 0040)。フロントマターの `status` で指定する。
 *
 * 既定は `published`。**どの status の記事も D1 / R2 に同期する** — 「同期しない記事」
 * という概念は無い。読み手から隠すのは配信の時点で行う。
 *
 * 読み手から見た振る舞いは 3 種類しかない (公開 / 限定公開 / 隠す)。`withdrawn` /
 * `draft` / `idea` は読み手に対しては同じで、違うのは管理者の一覧での意味づけだけ。
 * それでも分けているのは、「これから書くもの」と「もう出さないと決めたもの」を
 * 一覧で見分けたいため。
 */
export const articleStatuses = ["published", "unlisted", "withdrawn", "draft", "idea"] as const;

export type ArticleStatus = (typeof articleStatuses)[number];

/** 既定の status。フロントマターに `status` を書かなければこれになる。 */
export const DEFAULT_ARTICLE_STATUS: ArticleStatus = "published";

/** 文字列が status として読めるか。 */
export function isArticleStatus(value: string): value is ArticleStatus {
  return (articleStatuses as readonly string[]).includes(value);
}

/**
 * 一覧・フィード・sitemap・検索・関連記事・人気順に出してよいか。
 *
 * 読み手が**辿り着ける**かどうかではなく、**こちらから差し出す**かどうかを見る。
 * `unlisted` は URL を知っていれば読めるが、ここには出さない。
 */
export function isListedToReaders(status: ArticleStatus): boolean {
  return status === "published";
}

/**
 * URL を直に打った読み手に見せてよいか。
 *
 * `unlisted` を通すのは、URL を知っていれば読めるのがこの status の定義だから。
 * 秘密にするのではなく、一覧と検索エンジンから外すだけ。
 */
export function isReachableByReaders(status: ArticleStatus): boolean {
  return status === "published" || status === "unlisted";
}

/**
 * 検索エンジンに載せないよう伝えるか。
 *
 * 読み手が URL で辿り着けるのに一覧には出さない `unlisted` だけが対象。隠す status は
 * そもそも 404 を返すので、伝える相手がいない。
 */
export function shouldTellRobotsNoindex(status: ArticleStatus): boolean {
  return status === "unlisted";
}
