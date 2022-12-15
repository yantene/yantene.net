import { ValidationPipe } from "@nestjs/common";
import { NestFactory } from "@nestjs/core";
import {
  FastifyAdapter,
  NestFastifyApplication,
} from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
  );
  app.useGlobalPipes(new ValidationPipe({ transform: true }));

  // Swagger
  const config = new DocumentBuilder()
    .setTitle(process.env.npm_package_name ?? "backend")
    .setVersion(process.env.npm_package_version ?? "unknown")
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("spec", app, document);

  await app.listen(3100, "0.0.0.0");
}

bootstrap();
