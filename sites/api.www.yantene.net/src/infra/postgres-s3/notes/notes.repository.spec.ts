import { Test, TestingModule } from "@nestjs/testing";
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

  describe("findByCreatedAt()", () => {});

  describe("findByModifiedAt()", () => {});

  describe("findOne()", () => {});

  describe("findMany()", () => {});

  describe("create()", () => {});

  describe("update()", () => {});

  describe("destroy()", () => {});

  describe("findLinkedNotes()", () => {});

  describe("findBacklinkedNotes()", () => {});
});
