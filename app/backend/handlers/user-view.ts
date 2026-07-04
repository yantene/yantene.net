import type { User } from "~/backend/domain/user";

/**
 * 外部 (JSON API / Inertia props) に公開してよい User の表現。
 * ドメインエンティティをそのまま晒さず、公開可能なフィールドだけに絞る。
 */
export interface PublicUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
}

/** User エンティティを公開 DTO へ変換する (API / pages 共通)。 */
export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    email: user.email.toJSON(),
    displayName: user.displayName,
  };
}
