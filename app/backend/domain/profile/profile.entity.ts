import type { LifeEvent } from "./life-event.vo";
import type { ProfileName } from "./profile-name.vo";
import type { SocialAccount } from "./social-account.vo";
import type { Tagline } from "./tagline.vo";
import type { Temporal } from "@js-temporal/polyfill";
import type { EntityId, ImageUrl, IPersisted, IUnpersisted } from "~/backend/domain/shared";

export type ProfileId = EntityId<"Profile">;

/**
 * プロフィールの行の識別子。
 *
 * サイトに書き手は 1 人なので、この集約は常に 1 行しかない。採番せずに固定値を置くのは、
 * 「2 行目が入りうる」という形をそもそも作らないため。主キーが固定なら upsert が
 * 1 文で済み、消し忘れた古い行が残ることもない。
 */
export const PROFILE_ID = "profile" as ProfileId;

interface ProfileFields<T extends IPersisted | IUnpersisted> {
  readonly id: T["id"] extends string ? ProfileId : undefined;
  readonly name: ProfileName;
  /** 短い自己紹介。3 か所 (トップ・記事末尾・`/about`) が同じものを出す。 */
  readonly tagline: Tagline;
  /** 顔写真。フロントマターに avatar が無ければ undefined。 */
  readonly avatarUrl: ImageUrl | undefined;
  /** 出ていく先。フロントマターに書いた順に出す。 */
  readonly socials: readonly SocialAccount[];
  /** これまでにあった出来事。日付の古い順 (同じ日付なら書いた順)。 */
  readonly lifeEvents: readonly LifeEvent[];
  /** コンテンツリポジトリのリビジョン識別子 (Markdown + アセットの合成ハッシュ)。 */
  readonly sourceHash: string;
  readonly createdAt: T["createdAt"];
  readonly updatedAt: T["updatedAt"];
}

/**
 * プロフィール集約。
 *
 * 長い自己紹介 (本文の MDAST) と顔写真の実体は R2 にあり、このエンティティが表すのは
 * D1 に置くメタデータ。短い自己紹介をここに持つのは、記事の末尾が毎回読むため。
 */
export class Profile<T extends IPersisted | IUnpersisted = IPersisted> {
  private constructor(private readonly fields: ProfileFields<T>) {}

  static create(params: {
    name: ProfileName;
    tagline: Tagline;
    avatarUrl?: ImageUrl;
    socials: readonly SocialAccount[];
    lifeEvents: readonly LifeEvent[];
    sourceHash: string;
  }): Profile<IUnpersisted> {
    return new Profile({
      id: undefined,
      name: params.name,
      tagline: params.tagline,
      avatarUrl: params.avatarUrl,
      socials: params.socials,
      lifeEvents: sortByDate(params.lifeEvents),
      sourceHash: params.sourceHash,
      createdAt: undefined,
      updatedAt: undefined,
    });
  }

  static reconstruct(params: {
    id: ProfileId;
    name: ProfileName;
    tagline: Tagline;
    avatarUrl: ImageUrl | undefined;
    socials: readonly SocialAccount[];
    lifeEvents: readonly LifeEvent[];
    sourceHash: string;
    createdAt: Temporal.Instant;
    updatedAt: Temporal.Instant;
  }): Profile {
    return new Profile(params);
  }

  get id(): ProfileFields<T>["id"] {
    return this.fields.id;
  }

  get name(): ProfileName {
    return this.fields.name;
  }

  get tagline(): Tagline {
    return this.fields.tagline;
  }

  get avatarUrl(): ImageUrl | undefined {
    return this.fields.avatarUrl;
  }

  get socials(): readonly SocialAccount[] {
    return this.fields.socials;
  }

  get lifeEvents(): readonly LifeEvent[] {
    return this.fields.lifeEvents;
  }

  get sourceHash(): string {
    return this.fields.sourceHash;
  }

  get createdAt(): ProfileFields<T>["createdAt"] {
    return this.fields.createdAt;
  }

  get updatedAt(): ProfileFields<T>["updatedAt"] {
    return this.fields.updatedAt;
  }
}

/**
 * 日付の古い順に並べる。
 *
 * 書き手が時系列で書くとは限らないので、出す側で決める。`toSorted` は安定なので、
 * 同じ日付の出来事は書いた順のまま残る (どちらが先かは日付から決められない)。
 */
function sortByDate(events: readonly LifeEvent[]): readonly LifeEvent[] {
  return events.toSorted((a, b) => a.date.sortKey.localeCompare(b.date.sortKey));
}
