import { Test, TestingModule } from "@nestjs/testing";
import { TagsNotesController } from "./tags-notes.controller";
import { NotesService } from "../../../domain/notes/notes.service";
import { TagsService } from "../../../domain/tags/tags.service";

describe("NotesController", () => {
  let controller: TagsNotesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TagsNotesController],
      providers: [TagsService, NotesService],
    }).compile();

    controller = module.get<TagsNotesController>(TagsNotesController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
