import {
  Controller,
  Get,
  Param,
} from "@nestjs/common";
import { NotesService } from "./notes.service";

@Controller("notes")
export class NotesController {
  constructor(private readonly notesService: NotesService) {}

  @Get()
  findAll() {
    return this.notesService.findAll();
  }

  @Get(":id")
  findOne(@Param("id") id: string) {
    return this.notesService.findOne(+id);
  }
}
