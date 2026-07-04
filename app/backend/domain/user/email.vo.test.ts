import { describe, expect, it } from "vitest";
import { Email, InvalidEmailError } from "./email.vo";

describe("Email", () => {
  it.each(["a@b.co", "foo.bar+tag@example.com", "USER@EXAMPLE.COM"])(
    "accepts valid email: %s",
    (raw) => {
      expect(() => Email.create(raw)).not.toThrow();
    },
  );

  it.each(["", " ", "no-at", "no@dot", "@no-local.com", "a@b"])(
    "rejects invalid email: %s",
    (raw) => {
      expect(() => Email.create(raw)).toThrow(InvalidEmailError);
    },
  );

  it("normalizes by trimming and lowercasing", () => {
    expect(Email.create("  Foo@Example.COM  ").toString()).toBe(
      "foo@example.com",
    );
  });

  it("compares equality after normalization", () => {
    expect(Email.create("a@b.co").equals(Email.create("A@B.CO"))).toBe(true);
  });
});
