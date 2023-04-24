import { Test, TestingModule } from "@nestjs/testing";
import { NoteFilesRepository } from "./note-files.repository";

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => jestPrisma.client),
}));

describe("NoteFilesRepository", () => {
  let repository: NoteFilesRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NoteFilesRepository],
    }).compile();

    repository = module.get<NoteFilesRepository>(NoteFilesRepository);
  });

  it("should be defined", () => {
    expect(repository).toBeDefined();
  });

  describe("findOne()", () => {});

  describe("findMany()", () => {});

  describe("createMissingOne()", () => {});

  describe("createMissingMany()", () => {});

  describe("cleanUp()", () => {});

  describe("uploadLocalFile()", () => {});
});
