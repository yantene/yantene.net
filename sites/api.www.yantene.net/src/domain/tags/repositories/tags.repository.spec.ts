import { Test, TestingModule } from "@nestjs/testing";
import { TagsRepository } from "./tags.repository";

describe("TagsRepository", () => {
  let repository: TagsRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TagsRepository],
    }).compile();

    repository = module.get<TagsRepository>(TagsRepository);
  });

  it("should be defined", () => {
    expect(repository).toBeDefined();
  });
});
