import { Temporal } from "@js-temporal/polyfill";
import { Test, TestingModule } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
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

  describe("#findByTitle()", () => {
    it("returns undefined if a nonexistent title is given", async () => {
      const note = await repository.findByTitle(
        new Title("存在しないタイトル"),
      );

      expect(note).toBeUndefined();
    });

    it("returns a note if the note title is given", async () => {
      const title = new Title("存在するタイトル");
      const now = Temporal.Now.instant();
      const body = new Body("記事の内容");

      const prisma = new PrismaClient();

      await prisma.note.create({
        data: {
          title: title.value,
          createdAt: new Date(now.epochMilliseconds),
          modifiedAt: new Date(now.epochMilliseconds),
          body: body.value,
        },
      });

      const note = await repository.findByTitle(title);

      expect(note?.title?.value).toBe(title.value);
    });
  });
});
