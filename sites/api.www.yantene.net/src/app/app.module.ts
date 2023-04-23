import { Module } from "@nestjs/common";
import { NotesModule } from "../web/controllers/notes/notes.module";

@Module({
  imports: [NotesModule],
})
export class AppModule {}
