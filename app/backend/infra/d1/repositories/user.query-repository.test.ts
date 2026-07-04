import { describe, expect, it } from "vitest";
import { D1UserCommandRepository } from "./user.command-repository";
import { D1UserQueryRepository } from "./user.query-repository";
import { entityId } from "~/backend/domain/shared";
import { Email, User } from "~/backend/domain/user";
import { createTestD1 } from "~/backend/infra/d1/test-helper";

describe("D1UserQueryRepository", () => {
  it("returns undefined when id is unknown", async () => {
    const query = new D1UserQueryRepository(createTestD1());
    expect(await query.findById(entityId<"User">("missing"))).toBeUndefined();
  });

  it("returns undefined when email is unknown", async () => {
    const query = new D1UserQueryRepository(createTestD1());
    expect(
      await query.findByEmail(Email.create("nobody@example.com")),
    ).toBeUndefined();
  });

  it("finds by id after save", async () => {
    const d1 = createTestD1();
    const cmd = new D1UserCommandRepository(d1);
    const query = new D1UserQueryRepository(d1);

    const saved = await cmd.save(
      User.create({
        email: Email.create("carol@example.com"),
        displayName: "Carol",
      }),
    );

    const found = await query.findById(saved.id);
    expect(found?.id).toBe(saved.id);
    expect(found?.email.toString()).toBe("carol@example.com");
  });

  it("matches email case-insensitively via normalized storage", async () => {
    const d1 = createTestD1();
    const cmd = new D1UserCommandRepository(d1);
    const query = new D1UserQueryRepository(d1);

    await cmd.save(
      User.create({
        email: Email.create("Dave@Example.COM"),
        displayName: "Dave",
      }),
    );

    expect(
      await query.findByEmail(Email.create("DAVE@example.com")),
    ).toBeDefined();
  });
});
