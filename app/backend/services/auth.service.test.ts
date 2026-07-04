import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { AuthService } from "./auth.service";
import type { IMailer } from "~/backend/domain/auth";
import type { IMagicLinkTokenStore } from "~/backend/domain/auth/magic-link";
import type { ISessionStore, IUnpersisted } from "~/backend/domain/shared";
import type {
  IUserCommandRepository,
  IUserQueryRepository,
} from "~/backend/domain/user";
import { entityId } from "~/backend/domain/shared";
import { DuplicateEmailError, Email, User } from "~/backend/domain/user";

// --- in-memory fakes (ポートだけ差し替えれば HTTP/D1/KV 無しで検証できる) ---

class FakeTokenStore implements IMagicLinkTokenStore {
  private readonly store = new Map<string, string>(); // token -> email

  issue(email: string): Promise<string> {
    const token = `token-for-${email}`;
    this.store.set(token, email);
    return Promise.resolve(token);
  }

  consume(token: string): Promise<undefined | { email: string }> {
    const email = this.store.get(token);
    if (email !== undefined) this.store.delete(token); // use-once
    return Promise.resolve(email === undefined ? undefined : { email });
  }

  seed(token: string, email: string): void {
    this.store.set(token, email);
  }
}

class FakeMailer implements IMailer {
  readonly outbox: { to: string; subject: string; body: string }[] = [];

  send(params: { to: string; subject: string; body: string }): Promise<void> {
    this.outbox.push(params);
    return Promise.resolve();
  }
}

class FakeSessionStore implements ISessionStore {
  readonly sessions = new Map<string, string>(); // sessionId -> userId
  private seq = 0;

  create(userId: string): Promise<string> {
    this.seq += 1;
    const sessionId = `session-${String(this.seq)}`;
    this.sessions.set(sessionId, userId);
    return Promise.resolve(sessionId);
  }

  get(sessionId: string): Promise<undefined | { userId: string }> {
    const userId = this.sessions.get(sessionId);
    return Promise.resolve(userId === undefined ? undefined : { userId });
  }

  delete(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    return Promise.resolve();
  }
}

class FakeUserStore {
  private readonly byId = new Map<string, User>();
  private readonly byEmail = new Map<string, User>();
  private seq = 0;

  readonly query: IUserQueryRepository = {
    findById: (id) => Promise.resolve(this.byId.get(id)),
    findByEmail: (email) => Promise.resolve(this.byEmail.get(email.toString())),
  };

  readonly command: IUserCommandRepository = {
    save: (user: User<IUnpersisted>) => {
      this.seq += 1;
      const id = entityId<"User">(`user-${String(this.seq)}`);
      const now = Temporal.Now.instant();
      const persisted = User.reconstruct({
        id,
        email: user.email,
        displayName: user.displayName,
        createdAt: now,
        updatedAt: now,
      });
      this.byId.set(id, persisted);
      this.byEmail.set(persisted.email.toString(), persisted);
      return Promise.resolve(persisted);
    },
    delete: (id) => {
      const user = this.byId.get(id);
      if (user !== undefined) {
        this.byId.delete(id);
        this.byEmail.delete(user.email.toString());
      }
      return Promise.resolve();
    },
  };
}

function makeService(): {
  service: AuthService;
  tokenStore: FakeTokenStore;
  mailer: FakeMailer;
  sessionStore: FakeSessionStore;
  users: FakeUserStore;
} {
  const tokenStore = new FakeTokenStore();
  const mailer = new FakeMailer();
  const sessionStore = new FakeSessionStore();
  const users = new FakeUserStore();
  const service = new AuthService(
    tokenStore,
    () => mailer,
    sessionStore,
    users.query,
    users.command,
  );
  return { service, tokenStore, mailer, sessionStore, users };
}

describe("AuthService", () => {
  it("requestMagicLink: トークンを発行し、リンク付きメールを送る", async () => {
    const { service, mailer } = makeService();

    await service.requestMagicLink(
      Email.create("alice@example.com"),
      (token) => `https://app.test/cb?token=${token}`,
    );

    expect(mailer.outbox).toHaveLength(1);
    expect(mailer.outbox[0]?.to).toBe("alice@example.com");
    expect(mailer.outbox[0]?.body).toContain(
      "https://app.test/cb?token=token-for-alice@example.com",
    );
  });

  it("signInWithVerifiedEmail: 未登録なら user を作成し session を発行する", async () => {
    const { service, sessionStore, users } = makeService();

    const { user, sessionId } = await service.signInWithVerifiedEmail(
      Email.create("bob@example.com"),
    );

    expect(user.id).toBeTypeOf("string");
    expect(user.displayName).toBe("bob"); // メアドのローカル部が既定
    expect(sessionStore.sessions.get(sessionId)).toBe(user.id);
    expect(
      await users.query.findByEmail(Email.create("bob@example.com")),
    ).toBeDefined();
  });

  it("signInWithVerifiedEmail: 既存 user は再利用し、毎回新しい session を張る", async () => {
    const { service } = makeService();
    const email = Email.create("carol@example.com");

    const first = await service.signInWithVerifiedEmail(email);
    const second = await service.signInWithVerifiedEmail(email);

    expect(second.user.id).toBe(first.user.id); // ユーザーは重複作成しない
    expect(second.sessionId).not.toBe(first.sessionId); // セッションは新規
  });

  it("signInWithVerifiedEmail: 競合 (save が DuplicateEmailError) でも取り直して成功する", async () => {
    const email = Email.create("race@example.com");
    const persisted = User.reconstruct({
      id: entityId<"User">("user-race"),
      email,
      displayName: "race",
      createdAt: Temporal.Now.instant(),
      updatedAt: Temporal.Now.instant(),
    });

    let findCalls = 0;
    const query: IUserQueryRepository = {
      findById: () => Promise.resolve(undefined as User | undefined),
      // 1 回目 (save 前) は未存在、2 回目 (catch 後) は競合相手が作成済み、を再現する。
      findByEmail: () => {
        findCalls += 1;
        return Promise.resolve(findCalls === 1 ? undefined : persisted);
      },
    };
    const command: IUserCommandRepository = {
      save: () => Promise.reject(new DuplicateEmailError(email.toString())),
      delete: () => Promise.resolve(),
    };
    const sessionStore = new FakeSessionStore();
    const service = new AuthService(
      new FakeTokenStore(),
      () => new FakeMailer(),
      sessionStore,
      query,
      command,
    );

    const { user, sessionId } = await service.signInWithVerifiedEmail(email);

    expect(user.id).toBe(persisted.id);
    expect(sessionStore.sessions.get(sessionId)).toBe(user.id);
  });

  it("signInWithVerifiedEmail: DuplicateEmailError 後も見つからなければ throw する", async () => {
    const email = Email.create("ghost@example.com");
    const query: IUserQueryRepository = {
      findById: () => Promise.resolve(undefined as User | undefined),
      findByEmail: () => Promise.resolve(undefined as User | undefined),
    };
    const command: IUserCommandRepository = {
      save: () => Promise.reject(new DuplicateEmailError(email.toString())),
      delete: () => Promise.resolve(),
    };
    const service = new AuthService(
      new FakeTokenStore(),
      () => new FakeMailer(),
      new FakeSessionStore(),
      query,
      command,
    );

    await expect(service.signInWithVerifiedEmail(email)).rejects.toBeInstanceOf(
      DuplicateEmailError,
    );
  });

  it("verifyMagicLink: 無効なトークンは undefined", async () => {
    const { service } = makeService();

    expect(await service.verifyMagicLink("does-not-exist")).toBeUndefined();
  });

  it("verifyMagicLink: 有効なトークンを use-once で消費し session を確立する", async () => {
    const { service, tokenStore } = makeService();
    tokenStore.seed("magic-1", "dave@example.com");

    const result = await service.verifyMagicLink("magic-1");

    expect(result?.user.email.toString()).toBe("dave@example.com");
    expect(result?.sessionId).toBeTypeOf("string");
    // 2 回目は消費済みなので無効
    expect(await service.verifyMagicLink("magic-1")).toBeUndefined();
  });
});
