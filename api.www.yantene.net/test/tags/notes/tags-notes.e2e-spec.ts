import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { TagsNotesModule } from "../../../src/web/controllers/tags/notes/tags-notes.module";

describe("NotesController (e2e)", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [TagsNotesModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it("GET /tags/diary/notes", () =>
    request(app.getHttpServer()).get("/tags/diary/notes").expect(200).expect({
      nextCursor: "",
      notes: [],
    }));
});
