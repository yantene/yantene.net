import { Temporal } from "@js-temporal/polyfill";
import { resolveContentStore, withSingleTreeRead } from "./resolve-content-store";
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
} from "~/backend/infra/d1/repositories";
import { WorkersAiEmbeddingGenerator } from "~/backend/infra/ai/workers-ai-embedding-generator";
import { OgpLinkCardFetcher } from "~/backend/infra/http/ogp-link-card-fetcher";
import { R2LinkCardAssetCache } from "~/backend/infra/r2/r2-link-card-asset-cache";
import { R2ArticleContentCache } from "~/backend/infra/r2/r2-article-content-cache";
import { R2ProfileContentCache } from "~/backend/infra/r2/r2-profile-content-cache";
import { LinkCardsRefreshService } from "~/backend/services/link-cards-refresh.service";
import { ArticleEmbeddingsRefreshService } from "~/backend/services/article-embeddings-refresh.service";
import { ArticlesRefreshService } from "~/backend/services/articles-refresh.service";
import { ProfileRefreshService } from "~/backend/services/profile-refresh.service";

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

  /*
   * 同期するものは 2 つある (記事とプロフィール) が、コンテンツリポジトリを引く口は 1 つに
   * 束ねる。どちらも入口でツリー全体を列挙するので、別々に持たせると外への往復が倍になる。
   */
  const content = withSingleTreeRead(resolveContentStore(env));

  const result = await new ArticlesRefreshService(
    content,
    new D1ArticleCommandRepository(env.D1),
    D1ArticleQueryRepository.forAdmin(env.D1),
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

  /*
   * 書き手のプロフィール (ADR 0041)。記事と同じツリーの `profile.md` 1 つを読む。
   *
   * **いちばん後ろに置く。** ここが落ちても、前の 3 つは済んでいる形にしたい。
   * とくにリンクカードは「今回変更のあった記事が参照する URL」しか取りに行かないので、
   * 途中で止めると**その push で同期された記事の新しいリンクにカードが作られない**。
   * 記事のハッシュはもう変わらないので、次の通常の refresh でも拾われず、force を
   * 流すまで素のリンクのままになる。プロフィールの不調で記事の見た目を欠けさせない。
   *
   * **本文のリンクをカードにしない。** プロフィールに貼るのは文中のリンクで、
   * 段落がリンク 1 つでできている形 (ADR 0014) にはならないため、集めても空になる。
   */
  const profile = await new ProfileRefreshService(
    content,
    new D1ProfileCommandRepository(env.D1),
    new D1ProfileQueryRepository(env.D1),
    new R2ProfileContentCache(env.R2),
  ).refresh({ force });

  return { ...result, profile, linkCards, embeddings };
}
