import type { Email } from "./email.vo";
import type { User, UserId } from "./user.entity";

export interface IUserQueryRepository {
  findById(id: UserId): Promise<User | undefined>;
  findByEmail(email: Email): Promise<User | undefined>;
}
