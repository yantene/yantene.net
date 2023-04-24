// cf. https://docs.nestjs.com/recipes/repl
import { repl } from "@nestjs/core";
import { AppModule } from "./app/app.module";

async function bootstrap(): Promise<any> {
  await repl(AppModule);
}
bootstrap();
