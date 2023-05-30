import { Test, TestingModule } from "@nestjs/testing";
import { NoteFilesRepository } from "./note-files.repository";
import { LocalFile } from "../../../domain/aggregates/notes/value-objects/local-file.value-object";

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

  describe("uploadLocalFile()", () => {
    describe("when a local file is not found", () => {});

    describe("when a local file is found", () => {
      it("should be able to download the remote file", async () => {
        const localFile = await LocalFile.build("./test/repo/assets/b1.jpg");

        const remoteFile = await repository.uploadLocalFile(localFile);

        console.log(localFile, remoteFile);
      });
    });
  });
});
