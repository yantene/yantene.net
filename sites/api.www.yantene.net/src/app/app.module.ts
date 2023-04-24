import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { NotesModule } from "../web/controllers/notes/notes.module";

@Module({
  imports: [ConfigModule.forRoot(), NotesModule],
})
export class AppModule {}
