import type { ArticleStatus } from "~/backend/domain/article";
import { isReachableByReaders } from "~/backend/domain/article";
import { currentAccount, PRIVATE_CACHE_HEADERS } from "~/backend/handlers/auth/current-account";
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

/**
 * その応答を共有キャッシュから遠ざけるか (ADR 0040)。
 *
 * **管理者であることだけでは決めない。** 読み手も URL で辿り着ける記事
 * (`published` / `unlisted`) の応答は、管理者が見ていても読み手が見るものと同じ中身
 * なので、載って困るものが無い。ここで一律に `no-store` を付けると、管理者が公開済みの
 * 記事を開くだけで**その記事の画像を毎回落とし直す**ことになる。
 *
 * 遠ざけるのは、管理者にしか見えない中身を返したときだけ。
 */
export function shouldKeepResponsePrivate(
  access: ArticleReadAccess,
  status: ArticleStatus,
): boolean {
  return access.admin && !isReachableByReaders(status);
}

/**
 * {@link shouldKeepResponsePrivate} が真のときだけ `PRIVATE_CACHE_HEADERS` を返す。
 *
 * Response を直に組む経路 (原文・アセット・JSON API) 用。ページの loader は
 * ヘッダーを別に組むので、あちらは述語のほうを使う。
 */
export function privateCacheHeadersFor(
  access: ArticleReadAccess,
  status: ArticleStatus,
): Readonly<Record<string, string>> {
  return shouldKeepResponsePrivate(access, status) ? PRIVATE_CACHE_HEADERS : {};
}
