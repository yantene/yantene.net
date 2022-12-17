import { Module } from "@nestjs/common";
import { NotesModule } from "../web/controllers/notes/notes.module";
import { TagsNotesModule } from "../web/controllers/tags/notes/tags-notes.module";
import { TagsModule } from "../web/controllers/tags/tags.module";

@Module({
  imports: [NotesModule, TagsModule, TagsNotesModule],
})
export class AppModule {}
