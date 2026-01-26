import { Temporal } from "@js-temporal/polyfill";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Click } from "../click.entity";
import { IncrementClickUsecase } from "./increment-click.usecase";
import type { IClickCommandRepository } from "../click.command-repository.interface";

describe("IncrementClickUsecase", () => {
  let mockRepository: IClickCommandRepository;
  let usecase: IncrementClickUsecase;

  beforeEach(() => {
    const saveFn = vi.fn();
    const countFn = vi.fn();
    mockRepository = {
      save: saveFn,
      count: countFn,
    };
    usecase = new IncrementClickUsecase(mockRepository);
  });

  it("should create click entity, save it, and return count", async () => {
    const mockPersistedClick = Click.reconstruct({
      id: "test-uuid",
      timestamp: Date.now(),
      createdAt: Temporal.Now.instant(),
      updatedAt: Temporal.Now.instant(),
    });

    const mockSave = mockRepository.save as ReturnType<typeof vi.fn>;
    const mockCount = mockRepository.count as ReturnType<typeof vi.fn>;

    mockSave.mockResolvedValue(mockPersistedClick);
    mockCount.mockResolvedValue(42);

    const result = await usecase.execute();

    expect(result).toEqual({ count: 42 });
    expect(mockSave).toHaveBeenCalledOnce();
    expect(mockCount).toHaveBeenCalledOnce();

    const savedClick = mockSave.mock.calls[0][0];
    expect(savedClick.id).toBeUndefined();
    expect(savedClick.timestamp).toBeTypeOf("number");
  });

  it("should use current timestamp when creating click", async () => {
    const beforeTimestamp = Date.now();

    const mockPersistedClick = Click.reconstruct({
      id: "test-uuid",
      timestamp: beforeTimestamp,
      createdAt: Temporal.Now.instant(),
      updatedAt: Temporal.Now.instant(),
    });

    const mockSave = mockRepository.save as ReturnType<typeof vi.fn>;
    const mockCount = mockRepository.count as ReturnType<typeof vi.fn>;

    mockSave.mockResolvedValue(mockPersistedClick);
    mockCount.mockResolvedValue(1);

    await usecase.execute();

    const afterTimestamp = Date.now();
    const savedClick = mockSave.mock.calls[0][0];

    expect(savedClick.timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
    expect(savedClick.timestamp).toBeLessThanOrEqual(afterTimestamp);
  });
});
