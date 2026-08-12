import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { KvSessionCommandRepository } from "./session.command-repository";
import { KvSessionQueryRepository } from "./session.query-repository";
import { NoteSlug } from "~/backend/domain/note";
import { ReactionEmoji } from "~/backend/domain/note-reaction";
import {
  SESSION_LIFETIME_DAYS,
  Session,
  SessionId,
} from "~/backend/domain/session";
import { createTestKv } from "~/backend/infra/kv/test-helper";

const today = Temporal.PlainDate.from("2026-08-12");
const alpha = NoteSlug.create("alpha");

function setup(): {
  store: Map<string, { value: string; expirationTtl: number | undefined }>;
  commands: KvSessionCommandRepository;
  queries: KvSessionQueryRepository;
} {
  const { kv, store } = createTestKv();
  return {
    store,
    commands: new KvSessionCommandRepository(kv),
    queries: new KvSessionQueryRepository(kv),
  };
}

describe("KvSessionQueryRepository#findById", () => {
  it("知らない識別子は undefined", async () => {
    // 期限切れも同じ扱いになる (KV は消えたキーを無いキーと区別しない)。
    const { queries } = setup();
    await expect(queries.findById(SessionId.issue())).resolves.toBeUndefined();
  });

  it("保存したセッションを読み戻せる", async () => {
    const { commands, queries } = setup();
    const saved = Session.start(SessionId.issue(), today).withView(
      alpha,
      today,
    );
    await commands.save(saved);

    const found = await queries.findById(saved.id);
    expect(found?.id.equals(saved.id)).toBe(true);
    expect(found?.startedOn.equals(today)).toBe(true);
    expect(found?.hasViewed(alpha, today)).toBe(true);
  });

  it("まだ何も数えていないセッションも読み戻せる", async () => {
    const { commands, queries } = setup();
    const saved = Session.start(SessionId.issue(), today);
    await commands.save(saved);

    const found = await queries.findById(saved.id);
    expect(found?.viewedOn).toBeUndefined();
    expect(found?.viewedNotes).toStrictEqual([]);
  });

  it("読めない記録は「無い」とみなす", async () => {
    // そのまま throw すると、その読み手は期限が切れるまで何も数えられなくなる。
    // undefined を返せば同じ識別子のまま起こし直され、次の保存で上書きされて直る。
    const { store, queries } = setup();
    const id = SessionId.issue();
    const broken = [
      "null",
      '"nope"',
      "{}",
      '{"startedOn":123}',
      '{"startedOn":"not-a-date"}',
      // 一部だけ読める記録も丸ごと捨てる。中途半端に生き残らせると、壊れたものが
      // 次の保存で「正しい記録」として書き戻される。
      '{"startedOn":"2026-08-12","viewedNotes":["alpha","Bad Slug"]}',
      '{"startedOn":"2026-08-12","viewedNotes":"alpha"}',
    ];

    for (const value of broken) {
      store.set(`session:${id.toString()}`, {
        value,
        expirationTtl: undefined,
      });
      await expect(queries.findById(id)).resolves.toBeUndefined();
    }
  });
});

describe("KvSessionCommandRepository#save", () => {
  it("セッション専用の接頭辞を付けたキーに書く", async () => {
    const { store, commands } = setup();
    const session = Session.start(SessionId.issue(), today);
    await commands.save(session);

    expect(store.has(`session:${session.id.toString()}`)).toBe(true);
    expect(store.size).toBe(1);
  });

  it("書くたびに期限を引き直す", async () => {
    const { store, commands } = setup();
    const session = Session.start(SessionId.issue(), today);
    await commands.save(session);

    expect(store.get(`session:${session.id.toString()}`)?.expirationTtl).toBe(
      SESSION_LIFETIME_DAYS * 86_400,
    );
  });

  it("持ち回るのは今日ぶんだけ", async () => {
    const { store, commands } = setup();
    const yesterday = today.subtract({ days: 1 });
    const session = Session.start(SessionId.issue(), yesterday)
      .withView(NoteSlug.create("beta"), yesterday)
      .withView(alpha, today);
    await commands.save(session);

    // 記録に残るのは今日の分だけ。閲覧履歴を溜め込まない。
    const stored: unknown = JSON.parse(
      store.get(`session:${session.id.toString()}`)?.value ?? "",
    );
    expect(stored).toStrictEqual({
      startedOn: "2026-08-11",
      viewedOn: "2026-08-12",
      viewedNotes: ["alpha"],
      reactions: [],
    });
  });

  /*
   * リアクションは閲覧と違って日をまたいでも捨てない。捨てると取り消しも差し替えも
   * できなくなり、同じ人が何度でも押せてしまう。
   */
  it("リアクションは日が変わっても持ち回る", async () => {
    const { store, commands } = setup();
    const yesterday = today.subtract({ days: 1 });
    const session = Session.start(SessionId.issue(), yesterday)
      .withReaction(alpha, ReactionEmoji.like(), yesterday)
      .withView(NoteSlug.create("beta"), today);
    await commands.save(session);

    const stored: unknown = JSON.parse(
      store.get(`session:${session.id.toString()}`)?.value ?? "",
    );
    expect(stored).toStrictEqual({
      startedOn: "2026-08-11",
      viewedOn: "2026-08-12",
      viewedNotes: ["beta"],
      reactions: [{ slug: "alpha", emoji: "❤️", reactedOn: "2026-08-11" }],
    });
  });

  it("保存したリアクションを読み戻せる", async () => {
    const { commands, queries } = setup();
    const session = Session.start(SessionId.issue(), today).withReaction(
      alpha,
      ReactionEmoji.create("🎉"),
      today,
    );
    await commands.save(session);

    const restored = await queries.findById(session.id);

    expect(restored?.reactionFor(alpha)?.emoji.toString()).toBe("🎉");
    expect(restored?.reactionFor(alpha)?.reactedOn.toString()).toBe(
      "2026-08-12",
    );
  });
});
