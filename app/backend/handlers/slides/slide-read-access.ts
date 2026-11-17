import { currentAccount } from "~/backend/handlers/auth/current-account";
import { D1SlideQueryRepository } from "~/backend/infra/d1/repositories";

/** スライドを 1 本引くときの読み取り口と、それが管理者向けかどうか。 */
export interface SlideReadAccess {
  readonly query: D1SlideQueryRepository;
  /**
   * 管理者として引いたか。応答を共有キャッシュから遠ざけるかは、これと引いたスライドの
   * status を `shouldKeepResponsePrivate` / `privateCacheHeadersFor`
   * (handlers/articles/article-read-access.ts) に渡して決める。
   */
  readonly admin: boolean;
}

/**
 * slug でスライドを 1 本引く経路の読み取り口を決める。判定は記事のもの
 * (`resolveArticleReadAccess`) と同じ (ADR 0040)。
 *
 * 管理者なら全 status、そうでなければ `published` + `unlisted`。
 *
 * **使うのは slug で 1 本引く経路だけ** — スライドのページ・原文 Markdown・アセット。
 * 一覧・フィード・sitemap・OG は、ログインしていても `forReaders` で固定する。
 */
export async function resolveSlideReadAccess(env: Env, request: Request): Promise<SlideReadAccess> {
  const account = await currentAccount(env, request);
  const admin = account?.admin === true;
  return {
    query: admin
      ? D1SlideQueryRepository.forAdmin(env.D1)
      : D1SlideQueryRepository.forReaders(env.D1),
    admin,
  };
}
