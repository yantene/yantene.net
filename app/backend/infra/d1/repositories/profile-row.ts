import type { profile, profileHistory, profileSocials } from "~/backend/infra/d1/schema";
import {
  HistoryEntry,
  Profile,
  ProfileName,
  SocialAccount,
  Tagline,
} from "~/backend/domain/profile";
import { entityId } from "~/backend/domain/shared";
import { unixToInstant } from "~/backend/infra/d1/temporal";

/**
 * D1 の 2 つの行を Profile エンティティに復元する。
 *
 * 値は保存時に VO 経由で検証済みなので、ここでの再検証は破損データの検知を兼ねる
 * (不正なら VO factory が throw する)。子の行は `position` 順に渡すこと。
 */
export function rowsToProfile(
  row: typeof profile.$inferSelect,
  socialRows: readonly (typeof profileSocials.$inferSelect)[],
  historyRows: readonly (typeof profileHistory.$inferSelect)[],
): Profile {
  return Profile.reconstruct({
    id: entityId<"Profile">(row.id),
    name: ProfileName.create(row.name),
    tagline: Tagline.create(row.tagline),
    socials: socialRows.map((social) =>
      SocialAccount.create({ platform: social.platform, url: social.url, isMe: social.isMe }),
    ),
    /* 書いていない欄は null で入っている。VO は「無い」を undefined で表す。 */
    history: historyRows.map((entry) =>
      HistoryEntry.create({
        chapter: entry.chapter,
        year: entry.year,
        text: entry.text,
        ...(entry.url === null ? {} : { url: entry.url }),
        ...(entry.note === null ? {} : { note: entry.note }),
      }),
    ),
    sourceHash: row.sourceHash,
    createdAt: unixToInstant(row.createdAt),
    updatedAt: unixToInstant(row.updatedAt),
  });
}
