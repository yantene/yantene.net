import { describe, expect, it } from "vitest";
import { Email } from "./email.vo";
import { User } from "./user.entity";

describe("User.create", () => {
  it("displayName を指定すればそのまま使う", () => {
    const user = User.create({
      email: Email.create("alice@example.com"),
      displayName: "Alice",
    });

    expect(user.displayName).toBe("Alice");
  });

  it("displayName 未指定ならメアドのローカル部を既定にする", () => {
    const user = User.create({ email: Email.create("bob@example.com") });

    expect(user.displayName).toBe("bob");
  });
});
