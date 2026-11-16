import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { D1ArticleViewCommandRepository } from "./article-view.command-repository";
import { D1ArticleViewQueryRepository } from "./article-view.query-repository";
import { D1ArticleCommandRepository } from "./article.command-repository";
import type { ArticleStatus } from "~/backend/domain/article";
import { Article, ArticleSlug, ArticleTitle } from "~/backend/domain/article";
import { viewWeightLog } from "~/backend/domain/article-view";
import { createTestD1 } from "~/backend/infra/d1/test-helper";

const VIEWED_ON = "2026-07-01";

interface Harness {
  readonly d1: D1Database;
  /** 記事を 1 本入れ、views 回読ませる。id を返す。 */
  seed: (params: {
    slug: string;
    publishedOn: string;
    status?: ArticleStatus;
    views?: number;
  }) => Promise<string>;
  popular: (limit: number) => Promise<readonly string[]>;
}

function setup(): Harness {
  const d1 = createTestD1();
  const articles = new D1ArticleCommandRepository(d1);
  const views = new D1ArticleViewCommandRepository(d1);

  return {
    d1,
    seed: async ({ slug, publishedOn, status = "published", views: count = 0 }) => {
      const article = await articles.upsert(
        Article.create({
          slug: ArticleSlug.create(slug),
          title: ArticleTitle.create(slug),
          summary: "s",
          imageUrl: undefined,
          publishedOn: Temporal.PlainDate.from(publishedOn),
          lastModifiedOn: Temporal.PlainDate.from(publishedOn),
          status,
          sourceHash: `hash-${slug}`,
        }),
      );
      for (let i = 0; i < count; i++) {
        await views.addView(article.id, viewWeightLog(VIEWED_ON));
      }
      return article.id;
    },
    popular: (limit) => new D1ArticleViewQueryRepository(d1).listPopularArticleIds(limit),
  };
}

describe("人気順", () => {
  it("よく読まれている順に並ぶ", async () => {
    const harness = setup();
    const few = await harness.seed({ slug: "few", publishedOn: "2026-01-10", views: 1 });
    const many = await harness.seed({ slug: "many", publishedOn: "2026-01-10", views: 5 });
    const some = await harness.seed({ slug: "some", publishedOn: "2026-01-10", views: 3 });

    expect(await harness.popular(10)).toEqual([many, some, few]);
  });

  /*
   * 人気順は記事の読み取り口 (forReaders) を通らずに表を直に引く。ここで status を
   * 絞らないと、上位 N 件を下書きが埋めてから forReaders が落とすので、結果が N 件に
   * 足りなくなる (ADR 0040)。
   */
  it("公開されていない記事がどれだけ読まれていても、上位を埋めない", async () => {
    const harness = setup();
    const hidden: readonly ArticleStatus[] = ["unlisted", "withdrawn", "draft", "idea"];
    for (const status of hidden) {
      await harness.seed({ slug: `hidden-${status}`, publishedOn: "2026-06-01", status, views: 9 });
    }
    const first = await harness.seed({ slug: "first", publishedOn: "2026-01-10", views: 3 });
    const second = await harness.seed({ slug: "second", publishedOn: "2026-01-10", views: 2 });
    const third = await harness.seed({ slug: "third", publishedOn: "2026-01-10", views: 1 });

    // 隠れている 4 本のほうがスコアは高いが、3 件の枠は公開記事だけで埋まる。
    expect(await harness.popular(3)).toEqual([first, second, third]);
  });

  it("まだ読まれていない記事も、新しく出した順に候補へ入る", async () => {
    const harness = setup();
    const older = await harness.seed({ slug: "older", publishedOn: "2026-01-10" });
    const newer = await harness.seed({ slug: "newer", publishedOn: "2026-03-10" });

    expect(await harness.popular(10)).toEqual([newer, older]);
  });

  /*
   * 投稿日が古い記事は、1 回読まれた時点で出発点が丸めで消え、スコアがちょうど同じに
   * なる。そこから先は公開日の新しい順、それも並べば id の昇順で決める。並びが実行ごとに
   * 揺れると、順位が理由もなく入れ替わる。
   */
  it("同点なら公開日の新しい順、それも同じなら id の昇順", async () => {
    const harness = setup();
    const old = await harness.seed({ slug: "old", publishedOn: "2015-01-01", views: 1 });
    const twinA = await harness.seed({ slug: "twin-a", publishedOn: "2018-01-01", views: 1 });
    const twinB = await harness.seed({ slug: "twin-b", publishedOn: "2018-01-01", views: 1 });

    expect(await harness.popular(10)).toEqual([...[twinA, twinB].toSorted(), old]);
  });
});
