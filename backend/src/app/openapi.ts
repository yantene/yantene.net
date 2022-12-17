import { INestApplication } from "@nestjs/common";
import { DocumentBuilder, OpenAPIObject, SwaggerModule } from "@nestjs/swagger";

export function generateOpenAPI(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle(process.env.npm_package_name ?? "backend")
    .setVersion(process.env.npm_package_version ?? "unknown")
    .build();

  const document = SwaggerModule.createDocument(app, config);

  return document;
}
