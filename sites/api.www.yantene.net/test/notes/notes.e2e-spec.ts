import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { NotesModule } from "../../src/web/controllers/notes/notes.module";

describe("NotesController (e2e)", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [NotesModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it("GET /notes", () =>
    request(app.getHttpServer()).get("/notes").expect(200).expect({
      nextCursor: "",
      notes: [],
    }));

  it("GET /notes/徒然草52", () => {
    const noteTitle = "徒然草52";

    return request(app.getHttpServer())
      .get(`/notes/${encodeURIComponent(noteTitle)}`)
      .expect(200)
      .expect({
        note: {
          title: "",
          tags: [],
          emoji: "",
          createdAt: "",
          modifiedAt: "",
          body: "",
        },
      });
  });
});
