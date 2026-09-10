import type { ArticleSlug } from "./article-slug.vo";

/** 検索インデックスに登録する 1 記事のテキスト。 */
export interface ArticleSearchDocument {
  readonly slug: ArticleSlug;
  readonly title: string;
  /** 本文のプレーンテキスト (MDAST から抽出)。 */
  readonly body: string;
}

/**
 * 全文検索インデックスの書き込み口 (Command)。読み取り (検索) は
 * IArticleQueryRepository.search が担う。実装 (infra) はどの検索基盤を使うかを隠蔽する。
 */
export interface IArticleSearchIndex {
  /** 記事を索引に登録する (既存があれば置き換え)。 */
  index(document: ArticleSearchDocument): Promise<void>;
  /** 記事を索引から削除する。 */
  remove(slug: ArticleSlug): Promise<void>;
}
