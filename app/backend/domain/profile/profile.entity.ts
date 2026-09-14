import type { ProfileName } from "./profile-name.vo";
import type { SocialAccount } from "./social-account.vo";
import type { Tagline } from "./tagline.vo";
import type { Temporal } from "@js-temporal/polyfill";
import type { EntityId, IPersisted, IUnpersisted } from "~/backend/domain/shared";

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
  /**
   * 生年月日。フロントマターに `dateOfBirth` が無ければ undefined。
   *
   * 粒度は日まで。**月まで・年までは受け取らない** (パーサが弾く)。粒度を許すと
   * 出し分けの分岐が要るうえ、生まれた日は書き手が確実に知っている 1 日である。
   */
  readonly dateOfBirth: Temporal.PlainDate | undefined;
  /** 出身地。フロントマターに `birthplace` が無ければ undefined。 */
  readonly birthplace: string | undefined;
  /** 出ていく先。フロントマターに書いた順に出す。 */
  readonly socials: readonly SocialAccount[];
  /** コンテンツリポジトリのリビジョン識別子 (Markdown + アセットの合成ハッシュ)。 */
  readonly sourceHash: string;
  readonly createdAt: T["createdAt"];
  readonly updatedAt: T["updatedAt"];
}

/**
 * プロフィール集約。
 *
 * 長い自己紹介 (本文の MDAST) は R2 にあり、このエンティティが表すのは D1 に置く
 * メタデータ。短い自己紹介をここに持つのは、記事の末尾が毎回読むため。
 *
 * **顔は持たない。** サイトのアイコン 1 つに決まっていて、書き手が選ぶものではない
 * (`app/lib/profile-fallback.ts` の `PROFILE_PHOTO`)。
 */
export class Profile<T extends IPersisted | IUnpersisted = IPersisted> {
  private constructor(private readonly fields: ProfileFields<T>) {}

  static create(params: {
    name: ProfileName;
    tagline: Tagline;
    dateOfBirth?: Temporal.PlainDate;
    birthplace?: string;
    socials: readonly SocialAccount[];
    sourceHash: string;
  }): Profile<IUnpersisted> {
    return new Profile({
      id: undefined,
      name: params.name,
      tagline: params.tagline,
      dateOfBirth: params.dateOfBirth,
      birthplace: params.birthplace,
      socials: params.socials,
      sourceHash: params.sourceHash,
      createdAt: undefined,
      updatedAt: undefined,
    });
  }

  static reconstruct(params: {
    id: ProfileId;
    name: ProfileName;
    tagline: Tagline;
    dateOfBirth: Temporal.PlainDate | undefined;
    birthplace: string | undefined;
    socials: readonly SocialAccount[];
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

  get dateOfBirth(): Temporal.PlainDate | undefined {
    return this.fields.dateOfBirth;
  }

  get birthplace(): string | undefined {
    return this.fields.birthplace;
  }

  get socials(): readonly SocialAccount[] {
    return this.fields.socials;
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
