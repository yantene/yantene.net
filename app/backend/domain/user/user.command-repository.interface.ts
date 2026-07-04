import type { User, UserId } from "./user.entity";
import type { IUnpersisted } from "~/backend/domain/shared";

export interface IUserCommandRepository {
  /**
   * 新規ユーザーを永続化する。
   * email が既存と衝突した場合は {@link DuplicateEmailError} を投げる。
   */
  save(user: User<IUnpersisted>): Promise<User>;
  delete(id: UserId): Promise<void>;
}
