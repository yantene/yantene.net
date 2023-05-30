import { Module } from "@nestjs/common";
import { ServeStaticModule } from "@nestjs/serve-static";
import { join } from "path";

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, "..", "..", "..", "..", "public", "media"),
      serveRoot: "/media",
      serveStaticOptions: {
        index: false,
      },
    }),
  ],
})
export class MediaModule {}
