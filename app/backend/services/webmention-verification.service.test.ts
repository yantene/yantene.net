import { describe, expect, it, vi } from "vitest";
import { WebmentionVerificationService } from "./webmention-verification.service";
import type { NoteId } from "~/backend/domain/note";
import type { ILogger } from "~/backend/domain/shared";
import type {
  IWebmentionCommandRepository,
  IWebmentionSourceFetcher,
  SourceFetchResult,
  Webmention,
} from "~/backend/domain/webmention";
import { entityId } from "~/backend/domain/shared";
import { WebmentionRequest, WebmentionUrl } from "~/backend/domain/webmention";

const noteId: NoteId = entityId<"Note">("note-1");
const SOURCE = "https://example.com/post/1";
const request = WebmentionRequest.create({
  source: SOURCE,
  target: "https://yantene.net/notes/hello",
  siteOrigin: "https://yantene.net",
});

const LINKING_HTML = `
  <div class="h-entry">
    <a class="u-in-reply-to" href="https://yantene.net/notes/hello">re</a>
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

function harness(result: SourceFetchResult): {
  service: WebmentionVerificationService;
  upsert: ReturnType<typeof vi.fn>;
  deleteBySource: ReturnType<typeof vi.fn>;
} {
  const fetcher: IWebmentionSourceFetcher = {
    fetch: () => Promise.resolve(result),
  };
  const upsert = vi.fn(() =>
    Promise.resolve(undefined as unknown as Webmention),
  );
  const deleteBySource = vi.fn(() => Promise.resolve());
  const commands: IWebmentionCommandRepository = {
    upsert,
    deleteBySource,
  };

  return {
    service: new WebmentionVerificationService(
      fetcher,
      commands,
      silentLogger(),
    ),
    upsert,
    deleteBySource,
  };
}

function fetched(html: string): SourceFetchResult {
  return { kind: "fetched", url: WebmentionUrl.create(SOURCE), html };
}

describe("WebmentionVerificationService", () => {
  it("target をリンクしていれば保存する", async () => {
    const { service, upsert } = harness(fetched(LINKING_HTML));

    await service.verify(noteId, request);

    expect(upsert).toHaveBeenCalledTimes(1);
    const stored = upsert.mock.calls[0][0] as Webmention;
    expect(stored.type.toString()).toBe("reply");
    expect(stored.target.toString()).toBe("hello");
    expect(stored.content?.toString()).toBe("いい記事だった");
  });

  /*
   * ここが検証の肝。source が target を指していなければ、送り手が何と言おうと保存しない。
   */
  it("リンクしていなければ保存しない", async () => {
    const { service, upsert, deleteBySource } = harness(
      fetched("<p>関係のない記事</p>"),
    );

    await service.verify(noteId, request);

    expect(upsert).not.toHaveBeenCalled();
    // 前に受け取っていたぶんは取り消し扱いにする。
    expect(deleteBySource).toHaveBeenCalledTimes(1);
  });

  it("送り元が消えていれば保存済みの行を落とす", async () => {
    const { service, upsert, deleteBySource } = harness({ kind: "gone" });

    await service.verify(noteId, request);

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

    await service.verify(noteId, request);

    expect(upsert).not.toHaveBeenCalled();
    expect(deleteBySource).not.toHaveBeenCalled();
  });

  it("mf2 の印が無いページはただの言及として保存する", async () => {
    const { service, upsert } = harness(
      fetched('<p><a href="https://yantene.net/notes/hello">これ</a></p>'),
    );

    await service.verify(noteId, request);

    const stored = upsert.mock.calls[0][0] as Webmention;
    expect(stored.type.toString()).toBe("mention");
  });
});
