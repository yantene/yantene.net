import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { NotesModule } from "../web/controllers/notes/notes.module";
import { MediaModule } from "../web/controllers/media/media.module";

@Module({
  imports: [
    ConfigModule.forRoot(),
    NotesModule,
    ...(process.env.MEDIA_ENABLE_SERVER === "true" ? [MediaModule] : []),
  ],
})
export class AppModule {}
