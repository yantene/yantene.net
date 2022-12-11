import { Module } from "@nestjs/common";
import { NotesService } from "../../domain/notes/notes.service";
import { NotesController } from "./notes.controller";

@Module({
  controllers: [NotesController],
  providers: [NotesService],
})
export class NotesModule {}
