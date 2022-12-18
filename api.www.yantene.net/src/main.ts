import { SwaggerModule } from "@nestjs/swagger";
import { createApp } from "./app/app";
import { generateOpenAPI } from "./app/openapi";

async function bootstrap(): Promise<any> {
  const app = await createApp();

  const document = generateOpenAPI(app);

  SwaggerModule.setup("spec", app, document);

  await app.listen(3100, "0.0.0.0");
}

bootstrap();
