import { Name } from "../models/name.value-object";
import { Tag } from "../models/tag.entity";
import { TagsRepositoryInterface } from "../models/tags.repository.interface";

export class TagsRepository implements TagsRepositoryInterface {
  findByName(_name: Name): Promise<Tag | undefined> {
    // TODO: implement me!
    return (async (): Promise<undefined> => undefined)();
  }
}
