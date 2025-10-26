import type { IPersisted } from "../persisted.interface";
import type { IUnpersisted } from "../unpersisted.interface";
import type { ErrorLog } from "./error-log.entity";

export interface IErrorLogCommandRepository {
  save(errorLog: ErrorLog<IUnpersisted>): Promise<ErrorLog<IPersisted>>;

  delete(id: string): Promise<void>;

  deleteAll(): Promise<void>;
}
