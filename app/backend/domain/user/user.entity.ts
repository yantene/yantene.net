import type { Email } from "./email.vo";
import type { Temporal } from "@js-temporal/polyfill";
import type {
  EntityId,
  IPersisted,
  IUnpersisted,
} from "~/backend/domain/shared";

export type UserId = EntityId<"User">;

interface UserFields<T extends IPersisted | IUnpersisted> {
  readonly id: T["id"] extends string ? UserId : undefined;
  readonly email: Email;
  readonly displayName: string;
  readonly createdAt: T["createdAt"];
  readonly updatedAt: T["updatedAt"];
}

export class User<T extends IPersisted | IUnpersisted = IPersisted> {
  private constructor(private readonly fields: UserFields<T>) {}

  static create(params: {
    email: Email;
    displayName?: string;
  }): User<IUnpersisted> {
    return new User({
      id: undefined,
      email: params.email,
      displayName: params.displayName ?? deriveDisplayName(params.email),
      createdAt: undefined,
      updatedAt: undefined,
    });
  }

  static reconstruct(params: {
    id: UserId;
    email: Email;
    displayName: string;
    createdAt: Temporal.Instant;
    updatedAt: Temporal.Instant;
  }): User {
    return new User(params);
  }

  get id(): UserFields<T>["id"] {
    return this.fields.id;
  }

  get email(): Email {
    return this.fields.email;
  }

  get displayName(): string {
    return this.fields.displayName;
  }

  get createdAt(): UserFields<T>["createdAt"] {
    return this.fields.createdAt;
  }

  get updatedAt(): UserFields<T>["updatedAt"] {
    return this.fields.updatedAt;
  }
}

/**
 * displayName 未指定時の既定値: メアドのローカル部。
 * Email VO が "@" の前に 1 文字以上を保証するため、ローカル部は空にならない。
 */
function deriveDisplayName(email: Email): string {
  return email.toString().split("@", 1)[0];
}
