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
  D1ProfileCommandRepository,
  D1ProfileQueryRepository,
  D1WorkCommandRepository,
  D1WorkQueryRepository,
} from "~/backend/infra/d1/repositories";
import { WorkersAiEmbeddingGenerator } from "~/backend/infra/ai/workers-ai-embedding-generator";
import { OgpLinkCardFetcher } from "~/backend/infra/http/ogp-link-card-fetcher";
import { R2LinkCardAssetCache } from "~/backend/infra/r2/r2-link-card-asset-cache";
import { R2ArticleContentCache } from "~/backend/infra/r2/r2-article-content-cache";
import { R2ProfileContentCache } from "~/backend/infra/r2/r2-profile-content-cache";
import { R2WorkContentCache } from "~/backend/infra/r2/r2-work-content-cache";
import { LinkCardsRefreshService } from "~/backend/services/link-cards-refresh.service";
import { ArticleEmbeddingsRefreshService } from "~/backend/services/article-embeddings-refresh.service";
import { ArticlesRefreshService } from "~/backend/services/articles-refresh.service";
import { ProfileRefreshService } from "~/backend/services/profile-refresh.service";
import { WorksRefreshService } from "~/backend/services/works-refresh.service";

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
  const contentStore = resolveContentStore(env);

  const result = await new ArticlesRefreshService(
    contentStore,
    new D1ArticleCommandRepository(env.D1),
    D1ArticleQueryRepository.forAdmin(env.D1),
    new R2ArticleContentCache(env.R2),
    new D1ArticleSearchIndex(env.D1),
  ).refresh({ force });

  /*
   * プロフィールも同じツリーから同期する (`listTree()` の結果は 1 refresh の間
   * 覚えているので、ツリーを読み直しはしない)。記事の後に置くのは、記事の同期が
   * 落ちたときにプロフィールだけ先に進まないようにするため。ツリーごと空に見える
   * 事故は、こちらも自前のガードで止める。
   */
  const profile = await new ProfileRefreshService(
    contentStore,
    new D1ProfileCommandRepository(env.D1),
    new D1ProfileQueryRepository(env.D1),
    new R2ProfileContentCache(env.R2),
  ).refresh({ force });

  /*
   * 作ったものも同じツリーから同期する。記事と同じ形 (`works/<slug>.md` + `works/<slug>/`)
   * なので、経路も同じ。こちらもツリーごと空に見える事故は自前のガードで止める。
   */
  const works = await new WorksRefreshService(
    contentStore,
    new D1WorkCommandRepository(env.D1),
    new D1WorkQueryRepository(env.D1),
    new R2WorkContentCache(env.R2),
  ).refresh({ force });

  // 本文に貼られた URL のカードを揃える。記事の同期とは失敗の扱いが違う
  // (外部サイトが落ちていることは異常ではない) ので、別のサービスに分けている。
  // 長い自己紹介と作品の説明が貼った URL も同じ表に入れる
  // (`/about` と `/works/<slug>` だけカードにならない、を避ける)。
  const logger = new ConsoleLogger({ component: "link-cards" });
  const linkedUrls = [
    ...new Set([...result.linkedUrls, ...profile.linkedUrls, ...works.linkedUrls]),
  ];
  const linkCards = await new LinkCardsRefreshService(
    new OgpLinkCardFetcher(logger),
    new D1LinkCardCommandRepository(env.D1),
    new D1LinkCardQueryRepository(env.D1),
    new R2LinkCardAssetCache(env.R2),
    logger,
  ).sync(linkedUrls, Temporal.Now.instant(), { force });

  /*
   * 記事のベクトルと、記事どうしの近さを揃える。ここも記事の同期とは失敗の扱いが
   * 違う (外部のモデルに触るので落ちることがある) ので別のサービスに分けている。
   * 作れなかった記事は前回のベクトルと近さがそのまま残り、関連記事は前の並びで出る。
   *
   * ⚠️ **ここだけは `forReaders`。** 記事の同期と違い、作る対象を絞りたい (ADR 0040)。
   *
   * 下書きや書きかけの本文は「執筆計画」であって記事ではないので、そこから作った
   * ベクトルは近さの意味を持たない。加えて 1 回に作れるのは 30 本までなので、
   * **公開した記事のベクトル生成が書きかけに押し出される**。`article_similarities`
   * も記事数の 2 乗で増えるところへ、出さないものぶんが乗る。
   *
   * 掃除 (`deleteOrphans`) は `articles` の表を直に見るので、ここで絞っても
   * 消えた記事の行はきちんと片付く。公開 → 取り下げに転んだ記事のベクトルは残るが、
   * `findRelatedSlugs` が出さないので表には出ない (出し直せばそのまま使える)。
   */
  const embeddings = await new ArticleEmbeddingsRefreshService(
    new WorkersAiEmbeddingGenerator(env.AI),
    new D1ArticleEmbeddingCommandRepository(env.D1),
    new D1ArticleEmbeddingQueryRepository(env.D1),
    D1ArticleQueryRepository.forReaders(env.D1),
    new R2ArticleContentCache(env.R2),
    new ConsoleLogger({ component: "article-embeddings" }),
  ).sync({ force });

  // linkedUrls は 3 つを合わせたもの (カードの同期に渡したものと同じ) を返す。
  // 記事の分だけを返すと、`/about` と `/works/<slug>` のカードが取れたか取れなかったかを
  // 結果から辿れない。
  return { ...result, linkedUrls, profile, works, linkCards, embeddings };
}
