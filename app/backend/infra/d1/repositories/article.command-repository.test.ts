import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { D1ArticleCommandRepository } from "./article.command-repository";
import { D1ArticleQueryRepository } from "./article.query-repository";
import { D1ContentReactionCommandRepository } from "./content-reaction.command-repository";
import { D1ContentReactionQueryRepository } from "./content-reaction.query-repository";
import { D1ContentViewCommandRepository } from "./content-view.command-repository";
import type { IUnpersisted } from "~/backend/domain/shared";
import { ImageUrl, Article, ArticleSlug, ArticleTitle } from "~/backend/domain/article";
import { ReactionEmoji } from "~/backend/domain/content-reaction";
import { logScoreAfterView, viewWeightLog } from "~/backend/domain/content-view";
import { articleRef, entityId } from "~/backend/domain/shared";
import { createTestD1, readViewLogScore } from "~/backend/infra/d1/test-helper";

function unpersistedArticle(params: {
  slug: string;
  title: string;
  summary?: string;
  imageUrl?: string;
  publishedOn?: string;
  lastModifiedOn?: string;
  sourceHash?: string;
}): Article<IUnpersisted> {
  return Article.create({
    slug: ArticleSlug.create(params.slug),
    title: ArticleTitle.create(params.title),
    summary: params.summary ?? "summary",
    imageUrl: params.imageUrl === undefined ? undefined : ImageUrl.create(params.imageUrl),
    publishedOn: Temporal.PlainDate.from(params.publishedOn ?? "2026-01-15"),
    lastModifiedOn: Temporal.PlainDate.from(params.lastModifiedOn ?? "2026-01-20"),
    status: "published",
    sourceHash: params.sourceHash ?? "hash-0",
  });
}

describe("D1ArticleCommandRepository", () => {
  it("inserts a new article and returns it persisted", async () => {
    const cmd = new D1ArticleCommandRepository(createTestD1());

    const saved = await cmd.upsert(
      unpersistedArticle({
        slug: "hello",
        title: "Hello",
        imageUrl: "/api/v1/articles/hello/assets/cover.png",
      }),
    );

    expect(saved.id).toBeTruthy();
    expect(saved.slug.toString()).toBe("hello");
    expect(saved.title.toString()).toBe("Hello");
    expect(saved.imageUrl?.toString()).toBe("/api/v1/articles/hello/assets/cover.png");
    expect(saved.createdAt).toBeInstanceOf(Temporal.Instant);
    expect(saved.updatedAt).toBeInstanceOf(Temporal.Instant);
  });

  it("stores an article without a cover image as undefined", async () => {
    const cmd = new D1ArticleCommandRepository(createTestD1());
    const saved = await cmd.upsert(unpersistedArticle({ slug: "x", title: "X" }));
    expect(saved.imageUrl).toBeUndefined();
  });

  it("updates in place on slug conflict, keeping the same id", async () => {
    const d1 = createTestD1();
    const cmd = new D1ArticleCommandRepository(d1);
    const query = D1ArticleQueryRepository.forReaders(d1);

    const first = await cmd.upsert(unpersistedArticle({ slug: "post", title: "Original" }));
    const second = await cmd.upsert(
      unpersistedArticle({ slug: "post", title: "Updated", summary: "new" }),
    );

    expect(second.id).toBe(first.id);
    expect(second.title.toString()).toBe("Updated");
    expect(second.summary).toBe("new");
    expect(second.createdAt.equals(first.createdAt)).toBe(true);

    const { total } = await query.list({
      limit: 10,
      offset: 0,
      sortBy: "publishedOn",
      direction: "desc",
    });
    expect(total).toBe(1);
  });

  it("deletes an article by slug", async () => {
    const d1 = createTestD1();
    const cmd = new D1ArticleCommandRepository(d1);
    const query = D1ArticleQueryRepository.forReaders(d1);

    await cmd.upsert(unpersistedArticle({ slug: "gone", title: "Gone" }));
    await cmd.deleteBySlug(ArticleSlug.create("gone"));

    expect(await query.findBySlug(ArticleSlug.create("gone"))).toBeUndefined();
  });

  it("deletes an article by id", async () => {
    const d1 = createTestD1();
    const cmd = new D1ArticleCommandRepository(d1);
    const query = D1ArticleQueryRepository.forReaders(d1);

    const saved = await cmd.upsert(unpersistedArticle({ slug: "byid", title: "T" }));
    await cmd.delete(saved.id);

    expect(await query.findBySlug(ArticleSlug.create("byid"))).toBeUndefined();
  });

  /*
   * 反応と閲覧数は種別をまたぐ表にあり、記事への FK が無い (ADR 0051)。記事と一緒に
   * 作り、記事と一緒に消すのはこのリポジトリの仕事になる。
   */
  describe("反応と閲覧数の行", () => {
    const VIEWED_ON = "2026-02-01";
    const LIKE = ReactionEmoji.like();

    async function readViewCount(d1: D1Database, articleId: string): Promise<number | undefined> {
      const row = await d1
        .prepare(
          "SELECT view_count AS count FROM content_views WHERE kind = 'article' AND content_id = ?",
        )
        .bind(articleId)
        .first<{ count: number }>();
      return row?.count;
    }

    /** 1 回読まれ、リアクションが 1 つ付いた記事。 */
    async function seedEngaged(d1: D1Database, slug: string): Promise<string> {
      const saved = await new D1ArticleCommandRepository(d1).upsert(
        unpersistedArticle({ slug, title: slug }),
      );
      await new D1ContentViewCommandRepository(d1).addView(
        articleRef(saved.id),
        viewWeightLog(VIEWED_ON),
      );
      await new D1ContentReactionCommandRepository(d1).increment(articleRef(saved.id), LIKE);
      return saved.id;
    }

    it("新しい記事には、投稿日の重みから始まる閲覧数の行ができる", async () => {
      const d1 = createTestD1();

      const saved = await new D1ArticleCommandRepository(d1).upsert(
        unpersistedArticle({ slug: "fresh", title: "Fresh", publishedOn: "2026-01-15" }),
      );

      expect(await readViewCount(d1, saved.id)).toBe(0);
      expect(await readViewLogScore(d1, saved.id)).toBe(viewWeightLog("2026-01-15"));
    });

    /*
     * refresh は中身の変わった記事を upsert し直す。取り下げて出し直すのも同じ道を通る。
     * そこで数が巻き戻ると、読まれた実績が記事を直すたびに消える。
     */
    it("作り直しても、取り下げて出し直しても、閲覧数とリアクションは残る", async () => {
      const d1 = createTestD1();
      const cmd = new D1ArticleCommandRepository(d1);
      const id = await seedEngaged(d1, "kept");
      const scoreBefore = await readViewLogScore(d1, id);

      const withdrawn = Article.create({
        slug: ArticleSlug.create("kept"),
        title: ArticleTitle.create("Kept"),
        summary: "rewritten",
        imageUrl: undefined,
        publishedOn: Temporal.PlainDate.from("2026-03-01"),
        lastModifiedOn: Temporal.PlainDate.from("2026-03-01"),
        status: "withdrawn",
        sourceHash: "hash-1",
      });
      await cmd.upsert(withdrawn);
      await cmd.upsert(unpersistedArticle({ slug: "kept", title: "Kept", sourceHash: "hash-2" }));

      expect(await readViewCount(d1, id)).toBe(1);
      expect(scoreBefore).toBe(logScoreAfterView(viewWeightLog("2026-01-15"), VIEWED_ON));
      expect(await readViewLogScore(d1, id)).toBe(scoreBefore);
      expect(await new D1ContentReactionQueryRepository(d1).listByContent(articleRef(id))).toEqual([
        { emoji: "❤️", count: 1 },
      ]);
    });

    it.each([
      {
        name: "slug で消す",
        remove: (cmd: D1ArticleCommandRepository) => cmd.deleteBySlug(ArticleSlug.create("gone")),
      },
      {
        name: "id で消す",
        remove: (cmd: D1ArticleCommandRepository, id: string) =>
          cmd.delete(entityId<"Article">(id)),
      },
    ])("$name と、その記事の行だけが消える", async ({ remove }) => {
      const d1 = createTestD1();
      const gone = await seedEngaged(d1, "gone");
      const stays = await seedEngaged(d1, "stays");
      const reactions = new D1ContentReactionQueryRepository(d1);

      await remove(new D1ArticleCommandRepository(d1), gone);

      expect(await readViewCount(d1, gone)).toBeUndefined();
      expect(await reactions.listByContent(articleRef(gone))).toEqual([]);
      // 隣の記事は巻き込まれない。
      expect(await readViewCount(d1, stays)).toBe(1);
      expect(await reactions.listByContent(articleRef(stays))).toEqual([{ emoji: "❤️", count: 1 }]);
    });

    /*
     * 行だけが欠けた記事 (新しい表を足す migration と新しいコードのあいだに、旧いコードが
     * 作った記事) は、次に upsert されたときに旧い列の実績ごと行ができる。
     */
    it("行が欠けていた記事は、旧い列の値で行ができる", async () => {
      const d1 = createTestD1();
      const cmd = new D1ArticleCommandRepository(d1);
      const saved = await cmd.upsert(unpersistedArticle({ slug: "orphan", title: "Orphan" }));
      await d1.prepare("DELETE FROM content_views WHERE content_id = ?").bind(saved.id).run();
      await d1
        .prepare("UPDATE articles SET view_count = 4, view_log_score = 240.5 WHERE id = ?")
        .bind(saved.id)
        .run();

      await cmd.upsert(unpersistedArticle({ slug: "orphan", title: "Orphan", sourceHash: "h2" }));

      expect(await readViewCount(d1, saved.id)).toBe(4);
      expect(await readViewLogScore(d1, saved.id)).toBe(240.5);
    });
  });
});
