import { Temporal, toTemporalInstant } from "@js-temporal/polyfill";
import { PrismaClient } from "@prisma/client";
import { Name } from "../models/name.value-object";
import { Tag } from "../models/tag.entity";
import { TagsRepositoryInterface } from "../models/tags.repository.interface";

export class TagsRepository implements TagsRepositoryInterface {
  #prisma: PrismaClient;

  constructor() {
    this.#prisma = new PrismaClient();
  }

  async create(name: Name): Promise<Tag> {
    const timestamp = Temporal.Now.instant();

    const createdTag = await this.#prisma.tag.create({
      data: {
        name: name.value,
        createdAt: new Date(timestamp.epochMilliseconds),
        modifiedAt: new Date(timestamp.epochMilliseconds),
      },
    });

    const tag = this.#toTagEntity(createdTag);

    return tag;
  }

  async findByName(name: Name): Promise<Tag | undefined> {
    const foundTag = await this.#prisma.tag.findUnique({
      where: { name: name.value },
    });

    if (foundTag == null) {
      return undefined;
    }

    const tag = this.#toTagEntity(foundTag);

    return tag;
  }

  #toTagEntity(prismaTag: any): Tag {
    return new Tag(
      new Name(prismaTag.name),
      toTemporalInstant.bind(prismaTag.createdAt)(),
      toTemporalInstant.bind(prismaTag.modifiedAt)(),
    );
  }
}
