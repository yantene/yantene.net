import { Module } from "@nestjs/common";
import { TagsService } from "../../../../domain/tags/tags.service";
import { NotesService } from "../../../../domain/notes/notes.service";
import { TagsNotesController } from "./tags-notes.controller";

@Module({
  controllers: [TagsNotesController],
  providers: [TagsService, NotesService],
})
export class TagsNotesModule {}
