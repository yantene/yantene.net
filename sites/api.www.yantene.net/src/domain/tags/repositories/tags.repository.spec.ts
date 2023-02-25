import { Test, TestingModule } from "@nestjs/testing";
import { Name } from "../models/name.value-object";
import { TagsRepository } from "./tags.repository";

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => jestPrisma.client),
}));

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

  describe("#create", () => {
    it("returns a value object of the given value", async () => {
      const name = new Name("作成するタグ名");
      const createdTag = await repository.create(name);

      expect(createdTag.name.value).toBe(name.value);
    });

    it("increases the number of records in the Tags table by 1", async () => {
      const beforeCount = await jestPrisma.client.tag.count();

      const name = new Name("作成するタグ名");
      await repository.create(name);

      const afterCount = await jestPrisma.client.tag.count();

      expect(afterCount).toBe(beforeCount + 1);
    });
  });

  describe("#findByName", () => {
    it("returns undefined if a nonexistent name is given", async () => {
      const tag = await repository.findByName(new Name("存在しないタグ名"));

      expect(tag).toBeUndefined();
    });
    it("returns a tag if the tag name is given", async () => {
      const name = new Name("存在するタグ名");

      await repository.create(name);

      const foundTag = await repository.findByName(name);

      expect(foundTag?.name?.value).toBe(name.value);
    });
  });
});
