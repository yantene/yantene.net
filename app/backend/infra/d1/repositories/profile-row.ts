import type { profile, profileHistory, profileSocials } from "~/backend/infra/d1/schema";
import {
  HistoryDate,
  HistoryEntry,
  Profile,
  ProfileName,
  SocialAccount,
  Tagline,
} from "~/backend/domain/profile";
import { entityId } from "~/backend/domain/shared";
import { unixToInstant } from "~/backend/infra/d1/temporal";

/**
 * D1 の行を Profile エンティティに復元する。
 *
 * 値は保存時に VO 経由で検証済みなので、ここでの再検証は破損データの検知を兼ねる
 * (不正なら VO factory が throw する)。子の行は `position` 順に渡すこと。
 *
 * ⚠️ **経歴は含めない** (`rowsToHistory` が別に組む)。ここはトップと全記事ページが
 * 通る経路なので、読み捨てる行を組ませない (`profile.entity.ts`)。
 */
export function rowsToProfile(
  row: typeof profile.$inferSelect,
  socialRows: readonly (typeof profileSocials.$inferSelect)[],
): Profile {
  return Profile.reconstruct({
    id: entityId<"Profile">(row.id),
    name: ProfileName.create(row.name),
    tagline: Tagline.create(row.tagline),
    socials: socialRows.map((social) =>
      SocialAccount.create({ platform: social.platform, url: social.url, isMe: social.isMe }),
    ),
    sourceHash: row.sourceHash,
    createdAt: unixToInstant(row.createdAt),
    updatedAt: unixToInstant(row.updatedAt),
  });
}

/**
 * D1 の行を経歴に復元する。`position` 順に渡すこと。
 *
 * 書いていない欄は null で入っている。VO は「無い」を undefined で表す。日の精度は
 * **どこまで非 NULL か**で決まる (`month` が null なら年だけ)。終わりは `end_year` が
 * 入っていれば在る (始まりと同じ精度でしか入らないので、そこだけ見れば足りる)。
 */
export function rowsToHistory(
  historyRows: readonly (typeof profileHistory.$inferSelect)[],
): readonly HistoryEntry[] {
  return historyRows.map((entry) =>
    HistoryEntry.create({
      chapter: entry.chapter,
      date: HistoryDate.fromParts({
        year: entry.year,
        ...(entry.month === null ? {} : { month: entry.month }),
        ...(entry.day === null ? {} : { day: entry.day }),
      }),
      ...(entry.endYear === null
        ? {}
        : {
            until: HistoryDate.fromParts({
              year: entry.endYear,
              ...(entry.endMonth === null ? {} : { month: entry.endMonth }),
              ...(entry.endDay === null ? {} : { day: entry.endDay }),
            }),
          }),
      text: entry.text,
      ...(entry.url === null ? {} : { url: entry.url }),
      ...(entry.note === null ? {} : { note: entry.note }),
    }),
  );
}
