import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import * as request from "supertest";
import { FastifyAdapter } from "@nestjs/platform-fastify";
import { NotesModule } from "../../src/web/controllers/notes/notes.module";

describe("NotesController (e2e)", () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [NotesModule],
    }).compile();

    app = moduleFixture.createNestApplication(new FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
  });

  it("GET /notes", () =>
    request(app.getHttpServer())
      // NOTE: In e2e, if no parameters are passed, the parameters are undefined.
      .get("/notes?limit=20&order=newest")
      .expect(200));

  it("GET /notes/徒然草52", () => {
    const noteTitle = "徒然草52";

    return request(app.getHttpServer())
      .get(`/notes/${encodeURIComponent(noteTitle)}`)
      .expect(200);
  });
});
