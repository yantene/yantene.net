import type { IPersisted } from "../persisted.interface";
import type { IUnpersisted } from "../unpersisted.interface";
import type { Click } from "./click.entity";

export interface IClickCommandRepository {
  save(click: Click<IUnpersisted>): Promise<Click<IPersisted>>;
  count(): Promise<number>;
}
