import { Test, TestingModule } from "@nestjs/testing";
import { NotesRepository } from "./notes.repository";

describe("notesRepository", () => {
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
});
