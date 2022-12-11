import { Module } from "@nestjs/common";
import { NotesModule } from "./controllers/notes/notes.module";
import { TagsNotesModule } from "./controllers/tags/notes/tags-notes.module";
import { TagsModule } from "./controllers/tags/tags.module";

@Module({
  imports: [NotesModule, TagsModule, TagsNotesModule],
})
export class AppModule {}
