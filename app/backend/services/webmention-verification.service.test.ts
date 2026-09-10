import { describe, expect, it, vi } from "vitest";
import { WebmentionVerificationService } from "./webmention-verification.service";
import type { ArticleId } from "~/backend/domain/article";
import type { ILogger } from "~/backend/domain/shared";
import type {
  IWebmentionCommandRepository,
  IWebmentionSourceFetcher,
  SourceFetchResult,
  Webmention,
} from "~/backend/domain/webmention";
import { entityId } from "~/backend/domain/shared";
import { WebmentionRequest, WebmentionUrl } from "~/backend/domain/webmention";

const articleId: ArticleId = entityId<"Article">("article-1");
const SOURCE = "https://example.com/post/1";
const request = WebmentionRequest.create({
  source: SOURCE,
  target: "https://yantene.net/articles/hello",
  siteOrigin: "https://yantene.net",
});

const LINKING_HTML = `
  <div class="h-entry">
    <a class="u-in-reply-to" href="https://yantene.net/articles/hello">re</a>
    <div class="e-content"><p>いい記事だった</p></div>
  </div>`;

function silentLogger(): ILogger {
  const logger: ILogger = {
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
    child: () => logger,
  };
  return logger;
}

function harness(
  result: SourceFetchResult,
  blockedHosts: readonly string[] = [],
): {
  service: WebmentionVerificationService;
  upsert: ReturnType<typeof vi.fn>;
  deleteBySource: ReturnType<typeof vi.fn>;
} {
  const fetcher: IWebmentionSourceFetcher = {
    fetch: () => Promise.resolve(result),
  };
  const upsert = vi.fn(() => Promise.resolve(undefined as unknown as Webmention));
  const deleteBySource = vi.fn(() => Promise.resolve());
  const commands: IWebmentionCommandRepository = {
    upsert,
    deleteBySource,
  };

  return {
    service: new WebmentionVerificationService(
      fetcher,
      commands,
      // アイコンの写しはここでは見ない (写せなかった場合と同じ形で通す)。
      { mirror: () => Promise.resolve(undefined) },
      // 既定では誰も止めていない。止める場合のふるまいは専用のテストで見る。
      { listBlockedHosts: () => Promise.resolve(blockedHosts) },
      silentLogger(),
    ),
    upsert,
    deleteBySource,
  };
}

function fetched(html: string, resolvedUrl = SOURCE): SourceFetchResult {
  return { kind: "fetched", url: WebmentionUrl.create(resolvedUrl), html };
}

/** どこへ転送されても、こちらの記事を指すリンクを持つ文書。 */
const SELF_CANONICAL_HTML = '<link rel="canonical" href="https://yantene.net/articles/hello">';

describe("WebmentionVerificationService", () => {
  it("target をリンクしていれば保存する", async () => {
    const { service, upsert } = harness(fetched(LINKING_HTML));

    await service.verify(articleId, request);

    expect(upsert).toHaveBeenCalledTimes(1);
    const stored = upsert.mock.calls[0][0] as Webmention;
    expect(stored.type.toString()).toBe("reply");
    expect(stored.target.toString()).toBe("hello");
    expect(stored.content?.toString()).toBe("いい記事だった");
  });

  /*
   * `/notes/<slug>` から移した記事は 2 つの URL で応える (ADR 0032)。送り手がどちらの
   * 表記で届け出ても、ページにどちらが書いてあっても、同じ行に同じ種別で付く。
   *
   * 届け出た表記だけで照合すると、正規の URL を張っている他人のページを旧 URL 宛てで
   * 届け出るだけで「リンクが無い」と判定させ、その人の行を消せてしまう (行のキーは
   * article と source で、表記を含まない)。
   */
  describe("移した記事の 2 つの URL", () => {
    const linking = (href: string): string => `
        <div class="h-entry">
          <a class="u-in-reply-to" href="${href}">re</a>
          <div class="e-content"><p>おかえり</p></div>
        </div>`;
    const request = (target: string): WebmentionRequest =>
      WebmentionRequest.create({ source: SOURCE, target, siteOrigin: "https://yantene.net" });

    it.each([
      ["旧 URL 宛てで、ページも旧 URL", "/notes/back-from-times", "/notes/back-from-times"],
      ["旧 URL 宛てで、ページは正規の URL", "/notes/back-from-times", "/articles/back-from-times"],
      ["正規の URL 宛てで、ページは旧 URL", "/articles/back-from-times", "/notes/back-from-times"],
    ])("%s なら返信として保存し、消さない", async (_label, target, linked) => {
      const { service, upsert, deleteBySource } = harness(
        fetched(linking(`https://yantene.net${linked}`)),
      );

      await service.verify(articleId, request(`https://yantene.net${target}`));

      expect(deleteBySource).not.toHaveBeenCalled();
      expect(upsert).toHaveBeenCalledTimes(1);
      const stored = upsert.mock.calls[0][0] as Webmention;
      expect(stored.type.toString()).toBe("reply");
      expect(stored.target.toString()).toBe("back-from-times");
    });
  });

  /*
   * ここが検証の肝。source が target を指していなければ、送り手が何と言おうと保存しない。
   */
  it("リンクしていなければ保存しない", async () => {
    const { service, upsert, deleteBySource } = harness(fetched("<p>関係のない記事</p>"));

    await service.verify(articleId, request);

    expect(upsert).not.toHaveBeenCalled();
    // 前に受け取っていたぶんは取り消し扱いにする。
    expect(deleteBySource).toHaveBeenCalledTimes(1);
  });

  it("送り元が消えていれば保存済みの行を落とす", async () => {
    const { service, upsert, deleteBySource } = harness({ kind: "gone" });

    await service.verify(articleId, request);

    expect(upsert).not.toHaveBeenCalled();
    expect(deleteBySource).toHaveBeenCalledTimes(1);
  });

  /*
   * 相手が落ちているだけのときに消してしまうと、一時的な障害で過去の返信まで失う。
   * 何もしないのが正しい。
   */
  it("取りに行けなければ、保存も削除もしない", async () => {
    const { service, upsert, deleteBySource } = harness({
      kind: "unavailable",
      reason: "fetch failed",
    });

    await service.verify(articleId, request);

    expect(upsert).not.toHaveBeenCalled();
    expect(deleteBySource).not.toHaveBeenCalled();
  });

  /*
   * 転送で別のホストへ着いたら、読んだ文書は source の文書ではない。
   *
   * これを許すと、記事ページが出している自分自身への canonical リンクを使って
   * 「こちらへ転送するだけ」で検証を通せてしまう。第三者サイトのオープンリダイレクタを
   * 1 つ見つければ、その名前で好きな記事に行を作れる。
   */
  it("自サイトへ転送されたら保存しない", async () => {
    const { service, upsert, deleteBySource } = harness(
      fetched(SELF_CANONICAL_HTML, "https://yantene.net/articles/hello"),
    );

    await service.verify(articleId, request);

    expect(upsert).not.toHaveBeenCalled();
    expect(deleteBySource).not.toHaveBeenCalled();
  });

  /* 他人の本物の返信ページへ転送して、その人の名前と本文を横取りさせない。 */
  it("別のホストへ転送されたら保存しない", async () => {
    const { service, upsert } = harness(fetched(LINKING_HTML, "https://elsewhere.example/reply"));

    await service.verify(articleId, request);

    expect(upsert).not.toHaveBeenCalled();
  });

  /* スキームだけの転送 (http → https) は素通しさせる。 */
  it("同じホストの中での転送は通す", async () => {
    const { service, upsert } = harness(fetched(LINKING_HTML, "https://example.com/post/1/amp"));

    await service.verify(articleId, request);

    expect(upsert).toHaveBeenCalledTimes(1);
  });

  it("mf2 の印が無いページはただの言及として保存する", async () => {
    const { service, upsert } = harness(
      fetched('<p><a href="https://yantene.net/articles/hello">これ</a></p>'),
    );

    await service.verify(articleId, request);

    const stored = upsert.mock.calls[0][0] as Webmention;
    expect(stored.type.toString()).toBe("mention");
  });

  describe("ブロックリスト", () => {
    it("止めている送信元は取りに行かず、保存もしない", async () => {
      const { service, upsert, deleteBySource } = harness(fetched(LINKING_HTML), ["example.com"]);

      await service.verify(articleId, request);

      expect(upsert).not.toHaveBeenCalled();
      // 止める前に届いていた行が残らないよう、消しにいく。
      expect(deleteBySource).toHaveBeenCalledTimes(1);
    });

    it("止めている相手の下位ドメインからでも保存しない", async () => {
      const { service, upsert } = harness(fetched(LINKING_HTML), ["com"]);

      await service.verify(articleId, request);

      expect(upsert).not.toHaveBeenCalled();
    });

    it("止めていない送信元はこれまでどおり保存する", async () => {
      const { service, upsert } = harness(fetched(LINKING_HTML), ["other.example"]);

      await service.verify(articleId, request);

      expect(upsert).toHaveBeenCalledTimes(1);
    });
  });
});
