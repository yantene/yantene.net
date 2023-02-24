import { Test, TestingModule } from "@nestjs/testing";
import { Body } from "../models/body.value-object";
import { Title } from "../models/title.value-object";
import { NotesRepository } from "./notes.repository";

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => jestPrisma.client),
}));

describe("NotesRepository", () => {
  let repository: NotesRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotesRepository],
    }).compile();

    repository = module.get<NotesRepository>(NotesRepository);
  });

  it("should be defined", () => {
    expect(repository).toBeDefined();
  });

  describe("#create()", () => {
    it("returns a value object of the given value", async () => {
      const title = new Title("作成するタイトル");
      const body = new Body("記事の内容");
      const createdNote = await repository.create(title, body);

      expect(createdNote.title.value).toBe(title.value);
      expect(createdNote.body.value).toBe(body.value);
    });

    it("increases the number of records in the Notes table by 1", async () => {
      const beforeCount = await jestPrisma.client.note.count();

      const title = new Title("作成するタイトル");
      const body = new Body("記事の内容");
      await repository.create(title, body);

      const afterCount = await jestPrisma.client.note.count();

      expect(afterCount).toBe(beforeCount + 1);
    });
  });

  describe("#findByTitle()", () => {
    it("returns undefined if a nonexistent title is given", async () => {
      const note = await repository.findByTitle(
        new Title("存在しないタイトル"),
      );

      expect(note).toBeUndefined();
    });

    it("returns a note if the note title is given", async () => {
      const title = new Title("存在するタイトル");
      const body = new Body("記事の内容");

      await repository.create(title, body);

      const foundNote = await repository.findByTitle(title);

      expect(foundNote?.title?.value).toBe(title.value);
    });
  });
});
