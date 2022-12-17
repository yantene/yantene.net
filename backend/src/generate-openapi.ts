import * as fs from "fs";
import { dump } from "js-yaml";
import { createApp } from "./app/app";
import { generateOpenAPI, title } from "./app/openapi";

/**
 * @see {@link https://levelup.gitconnected.com/rest-api-end-to-end-test-automation-in-nestjs-9064be1b89b1}
 */
async function bootstrap() {
  const app = await createApp();

  const document = generateOpenAPI(app);

  fs.writeFileSync(`../openapi/${title()}.yaml`, dump(document, {}));
}

// eslint-disable-next-line no-console
bootstrap().then(() => console.log("Generated"));
