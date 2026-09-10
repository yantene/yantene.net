import { Temporal } from "@js-temporal/polyfill";
import { resolveContentStore } from "./resolve-content-store";
import { ConsoleLogger } from "~/backend/infra/console/console-logger";
import {
  D1LinkCardCommandRepository,
  D1LinkCardQueryRepository,
  D1ArticleCommandRepository,
  D1ArticleEmbeddingCommandRepository,
  D1ArticleEmbeddingQueryRepository,
  D1ArticleQueryRepository,
  D1ArticleSearchIndex,
} from "~/backend/infra/d1/repositories";
import { WorkersAiEmbeddingGenerator } from "~/backend/infra/ai/workers-ai-embedding-generator";
import { OgpLinkCardFetcher } from "~/backend/infra/http/ogp-link-card-fetcher";
import { R2LinkCardAssetCache } from "~/backend/infra/r2/r2-link-card-asset-cache";
import { R2ArticleContentCache } from "~/backend/infra/r2/r2-article-content-cache";
import { LinkCardsRefreshService } from "~/backend/services/link-cards-refresh.service";
import { ArticleEmbeddingsRefreshService } from "~/backend/services/article-embeddings-refresh.service";
import { ArticlesRefreshService } from "~/backend/services/articles-refresh.service";

/**
 * コンテンツリポジトリを D1 + R2 に同期する (Composition Root)。
 *
 * 呼ぶ口は 2 つある。**コンテンツリポジトリへの push で自動的に走る経路** (Queue の消費者) と、
 * **実装変更を既存の記事へ反映するために手で叩く経路** (`POST /api/v1/refresh?force=true`)。
 * push は「変わったものを取り込め」という合図でしかなく、「全部やり直せ」を意味する
 * push は存在しないので、force の口は残してある。
 */
export async function runRefresh(
  env: Env,
  options: { force: boolean },
): Promise<Record<string, unknown>> {
  const { force } = options;

  const result = await new ArticlesRefreshService(
    resolveContentStore(env),
    new D1ArticleCommandRepository(env.D1),
    new D1ArticleQueryRepository(env.D1),
    new R2ArticleContentCache(env.R2),
    new D1ArticleSearchIndex(env.D1),
  ).refresh({ force });

  // 本文に貼られた URL のカードを揃える。記事の同期とは失敗の扱いが違う
  // (外部サイトが落ちていることは異常ではない) ので、別のサービスに分けている。
  const logger = new ConsoleLogger({ component: "link-cards" });
  const linkCards = await new LinkCardsRefreshService(
    new OgpLinkCardFetcher(logger),
    new D1LinkCardCommandRepository(env.D1),
    new D1LinkCardQueryRepository(env.D1),
    new R2LinkCardAssetCache(env.R2),
    logger,
  ).sync(result.linkedUrls, Temporal.Now.instant(), { force });

  /*
   * 記事のベクトルと、記事どうしの近さを揃える。ここも記事の同期とは失敗の扱いが
   * 違う (外部のモデルに触るので落ちることがある) ので別のサービスに分けている。
   * 作れなかった記事は前回のベクトルと近さがそのまま残り、関連記事は前の並びで出る。
   */
  const embeddings = await new ArticleEmbeddingsRefreshService(
    new WorkersAiEmbeddingGenerator(env.AI),
    new D1ArticleEmbeddingCommandRepository(env.D1),
    new D1ArticleEmbeddingQueryRepository(env.D1),
    new D1ArticleQueryRepository(env.D1),
    new R2ArticleContentCache(env.R2),
    new ConsoleLogger({ component: "article-embeddings" }),
  ).sync({ force });

  return { ...result, linkCards, embeddings };
}
