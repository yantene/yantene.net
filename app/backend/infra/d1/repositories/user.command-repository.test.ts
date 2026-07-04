import { describe, expect, it } from "vitest";
import { D1UserCommandRepository } from "./user.command-repository";
import { D1UserQueryRepository } from "./user.query-repository";
import { DuplicateEmailError, Email, User } from "~/backend/domain/user";
import { createTestD1 } from "~/backend/infra/d1/test-helper";

describe("D1UserCommandRepository", () => {
  it("persists a new user and returns the reconstructed entity", async () => {
    const d1 = createTestD1();
    const cmd = new D1UserCommandRepository(d1);
    const query = new D1UserQueryRepository(d1);

    const saved = await cmd.save(
      User.create({
        email: Email.create("alice@example.com"),
        displayName: "Alice",
      }),
    );

    expect(saved.id).toBeTypeOf("string");
    const found = await query.findByEmail(Email.create("alice@example.com"));
    expect(found?.displayName).toBe("Alice");
    expect(found?.email.toString()).toBe("alice@example.com");
  });

  it("throws DuplicateEmailError when the email already exists", async () => {
    const d1 = createTestD1();
    const cmd = new D1UserCommandRepository(d1);

    await cmd.save(User.create({ email: Email.create("dup@example.com") }));

    await expect(
      cmd.save(User.create({ email: Email.create("dup@example.com") })),
    ).rejects.toBeInstanceOf(DuplicateEmailError);
  });

  it("deletes by id", async () => {
    const d1 = createTestD1();
    const cmd = new D1UserCommandRepository(d1);
    const query = new D1UserQueryRepository(d1);

    const saved = await cmd.save(
      User.create({
        email: Email.create("bob@example.com"),
        displayName: "Bob",
      }),
    );
    await cmd.delete(saved.id);

    expect(await query.findById(saved.id)).toBeUndefined();
  });
});
