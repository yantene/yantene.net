import type { profile, profileLifeEvents, profileSocials } from "~/backend/infra/d1/schema";
import {
  LifeEvent,
  LifeEventDate,
  Profile,
  ProfileName,
  SocialAccount,
  Tagline,
} from "~/backend/domain/profile";
import { entityId, ImageUrl } from "~/backend/domain/shared";
import { unixToInstant } from "~/backend/infra/d1/temporal";

/**
 * D1 の 3 つの行を Profile エンティティに復元する。
 *
 * 値は保存時に VO 経由で検証済みなので、ここでの再検証は破損データの検知を兼ねる
 * (不正なら VO factory が throw する)。子の行は `position` 順に渡すこと。
 */
export function rowsToProfile(
  row: typeof profile.$inferSelect,
  socialRows: readonly (typeof profileSocials.$inferSelect)[],
  eventRows: readonly (typeof profileLifeEvents.$inferSelect)[],
): Profile {
  return Profile.reconstruct({
    id: entityId<"Profile">(row.id),
    name: ProfileName.create(row.name),
    tagline: Tagline.create(row.tagline),
    avatarUrl: row.avatarUrl === null ? undefined : ImageUrl.create(row.avatarUrl),
    socials: socialRows.map((social) =>
      SocialAccount.create({ platform: social.platform, url: social.url, isMe: social.isMe }),
    ),
    lifeEvents: eventRows.map((event) =>
      LifeEvent.create({
        date: LifeEventDate.reconstruct(event.occurredOn, event.precision),
        kind: event.kind,
        title: event.title,
        description: event.description ?? undefined,
      }),
    ),
    sourceHash: row.sourceHash,
    createdAt: unixToInstant(row.createdAt),
    updatedAt: unixToInstant(row.updatedAt),
  });
}
