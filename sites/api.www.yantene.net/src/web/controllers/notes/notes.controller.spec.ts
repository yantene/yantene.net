import { Test, TestingModule } from "@nestjs/testing";
import { PrismaClient } from "@prisma/client";
import { NotesController } from "./notes.controller";
import { NotesUseCase } from "../../../domain/use-cases/notes/notes.use-case";
import { NotesRepository } from "../../../infra/postgres-s3/notes/notes.repository";
import { NestPrismaClient } from "../../../infra/postgres-s3/nest-prisma-client";

describe("NotesController", () => {
  let controller: NotesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotesController],
      providers: [
        NotesUseCase,
        { provide: "NotesRepositoryInterface", useClass: NotesRepository },
        { provide: PrismaClient, useClass: NestPrismaClient },
      ],
    }).compile();

    controller = module.get<NotesController>(NotesController);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });
});
