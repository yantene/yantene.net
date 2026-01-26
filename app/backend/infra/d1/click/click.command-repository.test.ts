import { describe, expect, it } from "vitest";
import { ClickCommandRepository } from "./click.command-repository";

describe("ClickCommandRepository", () => {
  // eslint-disable-next-line no-secrets/no-secrets
  it("should be a class that implements IClickCommandRepository", () => {
    const saveFn = ClickCommandRepository.prototype.save;
    const countFn = ClickCommandRepository.prototype.count;

    expect(ClickCommandRepository).toBeDefined();
    expect(saveFn).toBeDefined();
    expect(countFn).toBeDefined();
  });
});
