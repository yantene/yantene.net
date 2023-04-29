import { Test, TestingModule } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { NotesRepository } from "./notes.repository";
import { NestPrismaClient } from "../nest-prisma-client";

jest.mock("@prisma/client", () => ({
  PrismaClient: jest.fn().mockImplementation(() => jestPrisma.client),
}));

describe("NotesRepository", () => {
  let repository: NotesRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: "NotesRepositoryInterface", useClass: NotesRepository },
        { provide: PrismaClient, useClass: NestPrismaClient },
      ],
    }).compile();

    repository = module.get<NotesRepository>("NotesRepositoryInterface");
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
