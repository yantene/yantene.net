import type { PublicWork } from "./work-view";
import type { LinkCardMap } from "~/backend/handlers/link-cards/link-card-view";
import type { Root } from "mdast";
import { toPublicWork } from "./work-view";
import { workPath, WorkSlug } from "~/backend/domain/work";
import { loadLinkCards } from "~/backend/handlers/link-cards/load-link-cards";
import { loadProfile } from "~/backend/handlers/profile/pages.handler";
import {
  collectionPageJsonLd,
  personReference,
  websiteReference,
} from "~/backend/handlers/profile/person-json-ld";
import { D1WorkQueryRepository } from "~/backend/infra/d1/repositories";
import { R2WorkContentCache } from "~/backend/infra/r2/r2-work-content-cache";

export interface WorksPageData {
  /** 並び順 (`position` の小さい順)。まだ同期されていなければ空。 */
  readonly works: readonly PublicWork[];
  /**
   * `/works` の構造化データ (`CollectionPage`。ADR 0048)。**作品が 1 つも無いあいだは
   * `null`。** 「準備中」で `noindex` が立つページは、作ったものの一覧だと名乗らない。
   */
  readonly jsonLd: Record<string, unknown> | null;
}

export interface WorkDetailPageData {
  /** 見つからなければ null。ページは 404 を描く。 */
  readonly work: PublicWork | null;
  /** 詳しい説明。作品が無ければ null。 */
  readonly mdast: Root | null;
  /** 説明に貼られたむき出しの URL のカード。 */
  readonly linkCards: LinkCardMap;
  readonly jsonLd: Record<string, unknown> | null;
}

/**
 * 作品の一覧を引く。`/works` と `/about` が使う。
 *
 * **切らずに全件返す。** 作品は書き手が手で選んで置くもので、数十件に育つ前提が無い
 * (ADR 0042)。`/about` の側で「代表の N 件」に切らないのも同じ理由で、切るなら順位の
 * 定義が要るが、`position` が既にその役を果たしている。
 */
export async function loadWorks(env: Env): Promise<readonly PublicWork[]> {
  const works = await new D1WorkQueryRepository(env.D1).list();
  return works.map(toPublicWork);
}

/** `/works` のデータを揃える (Composition Root)。 */
export async function loadWorksPage(env: Env, origin: string): Promise<WorksPageData> {
  const works = await loadWorks(env);
  return {
    works,
    jsonLd: works.length === 0 ? null : collectionPageJsonLd(origin, "/works"),
  };
}

/**
 * `/works/<slug>` のデータを揃える (Composition Root)。
 *
 * - D1 にメタデータが無い = そもそも存在しない作品 → null (呼び出し側で 404)。
 * - D1 に在るのに R2 の MDAST が無い = キャッシュ不整合。静かに 404 で隠さず throw する
 *   (fail-loud)。公開済みの作品が消えて見えるより、不整合を表面化させる。
 */
export async function loadWorkDetailPage(
  env: Env,
  slugParam: string,
  origin: string,
): Promise<WorkDetailPageData> {
  const slug = WorkSlug.parse(slugParam);
  if (slug === undefined) return notFound();

  // 3 つは互いに独立なので並行に読む。プロフィールは、作った人を名指しするために要る。
  const [work, mdast, profile] = await Promise.all([
    new D1WorkQueryRepository(env.D1).findBySlug(slug),
    new R2WorkContentCache(env.R2).getMdast(slug),
    loadProfile(env),
  ]);

  if (work === undefined) return notFound();
  if (mdast === undefined) {
    throw new Error(`MDAST cache is missing for an indexed work: ${slug.toString()}`);
  }

  const publicWork = toPublicWork(work);
  return {
    work: publicWork,
    mdast: mdast as Root,
    linkCards: await loadLinkCards(env, mdast as Root),
    jsonLd: {
      "@context": "https://schema.org",
      "@type": "CreativeWork",
      name: publicWork.name,
      description: publicWork.summary,
      url: `${origin}${workPath(publicWork.slug)}`,
      // 外の在り処は「同じものを指す別の URL」。正規の URL はこちらなので url とは分ける。
      ...(publicWork.url === null ? {} : { sameAs: [publicWork.url] }),
      // 作った人は、記事の筆者や `/about` と同じ 1 人 (ADR 0048)。同じ `@id` で指す。
      creator: personReference(origin, profile),
      isPartOf: websiteReference(origin),
    },
  };
}

function notFound(): WorkDetailPageData {
  return { work: null, mdast: null, linkCards: {}, jsonLd: null };
}
