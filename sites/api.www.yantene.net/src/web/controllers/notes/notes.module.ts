import { Module } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { NotesController } from "./notes.controller";
import { NotesUseCase } from "../../../domain/use-cases/notes/notes.use-case";
import { NotesRepository } from "../../../infra/postgres-s3/notes/notes.repository";
import { NestPrismaClient } from "../../../infra/postgres-s3/nest-prisma-client";

@Module({
  controllers: [NotesController],
  providers: [
    NotesUseCase,
    { provide: "NotesRepositoryInterface", useClass: NotesRepository },
    { provide: PrismaClient, useClass: NestPrismaClient },
  ],
})
export class NotesModule {}
