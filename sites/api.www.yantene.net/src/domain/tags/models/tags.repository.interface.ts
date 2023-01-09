import { Name } from "./name.value-object";
import { Tag } from "./tag.entity";

export type TagsRepositoryInterface = {
  findByName(name: Name): Promise<Tag | undefined>;
};
