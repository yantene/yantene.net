import { currentAccount } from "~/backend/handlers/auth/current-account";
import { D1ArticleQueryRepository } from "~/backend/infra/d1/repositories";

/** 記事を 1 本引くときの読み取り口と、それが管理者向けかどうか。 */
export interface ArticleReadAccess {
  readonly query: D1ArticleQueryRepository;
  /**
   * 管理者として引いたか。**true なら応答に `PRIVATE_CACHE_HEADERS` を付けること。**
   * 付け忘れると、下書きの応答が経路のどこかに載って読み手に配られる。
   */
  readonly admin: boolean;
}

/**
 * slug で記事を 1 本引く経路の読み取り口を決める (ADR 0040)。
 *
 * 管理者なら全 status、そうでなければ `published` + `unlisted`。
 *
 * **使うのは slug で 1 本引く経路だけ** — 記事ページ・原文 Markdown・アセット。
 * 一覧・フィード・sitemap・検索・OG・人気順・関連記事・Webmention の受け口は、
 * ログインしていても `forReaders` で固定する。管理者が自分の下書きを `/articles` や
 * `/feed.xml` に混ぜて見たいわけではないし、混ぜると「管理者の一覧応答が共有キャッシュに
 * 載る」場合を増やすことになる。管理者向けの一覧は別に用意する (#466 の続き)。
 *
 * cookie が無ければ {@link currentAccount} は置き場を触らないので、読み手には
 * 何も足さない。
 */
export async function resolveArticleReadAccess(
  env: Env,
  request: Request,
): Promise<ArticleReadAccess> {
  const account = await currentAccount(env, request);
  const admin = account?.admin === true;
  return {
    query: admin
      ? D1ArticleQueryRepository.forAdmin(env.D1)
      : D1ArticleQueryRepository.forReaders(env.D1),
    admin,
  };
}
