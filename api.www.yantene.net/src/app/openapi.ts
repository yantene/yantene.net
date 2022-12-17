import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from "@nestjs/swagger";

export function title(): string {
  return process.env.npm_package_name ?? "api";
}

export function version(): string {
  return process.env.npm_package_version ?? "unknown";
}

export function generateOpenAPI(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle(title())
    .setVersion(version())
    .build();

  const document = SwaggerModule.createDocument(app, config);

  return document;
}
