import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { TagsModule } from "../../src/web/controllers/tags/tags.module";

describe("NotesController (e2e)", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TagsModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it("GET /tags", () =>
    request(app.getHttpServer()).get("/tags").expect(200).expect({
      nextNoteModifiedAtCursor: "",
      nextTaggedCursor: 0,
      tags: [],
    }));
});
