import type { LifeEvent, Profile as ProfileEntity } from "~/backend/domain/profile";
import type { IUnpersisted } from "~/backend/domain/shared";
import { describe, expect, it } from "vitest";
import { D1ProfileCommandRepository } from "./profile.command-repository";
import { D1ProfileQueryRepository } from "./profile.query-repository";
import {
  LifeEvent as LifeEventVo,
  LifeEventDate,
  Profile,
  ProfileName,
  SocialAccount,
  Tagline,
} from "~/backend/domain/profile";
import { ImageUrl } from "~/backend/domain/shared";
import { createTestD1 } from "~/backend/infra/d1/test-helper";

function lifeEvent(date: string, title: string): LifeEvent {
  return LifeEventVo.create({ date: LifeEventDate.create(date), kind: "milestone", title });
}

function unpersistedProfile(params: {
  name?: string;
  tagline?: string;
  avatarUrl?: string;
  socials?: readonly SocialAccount[];
  lifeEvents?: readonly LifeEvent[];
  sourceHash?: string;
}): ProfileEntity<IUnpersisted> {
  return Profile.create({
    name: ProfileName.create(params.name ?? "やんてね"),
    tagline: Tagline.create(params.tagline ?? "東京で Web 開発者をやっています。"),
    avatarUrl: params.avatarUrl === undefined ? undefined : ImageUrl.create(params.avatarUrl),
    socials: params.socials ?? [],
    lifeEvents: params.lifeEvents ?? [],
    sourceHash: params.sourceHash ?? "deadbeef",
  });
}

describe("D1ProfileCommandRepository", () => {
  it("inserts the profile with its socials and life events", async () => {
    const d1 = createTestD1();
    await new D1ProfileCommandRepository(d1).upsert(
      unpersistedProfile({
        avatarUrl: "/api/v1/profile/assets/avatar.png",
        socials: [
          SocialAccount.create({
            platform: "github",
            url: "https://github.com/yantene",
            isMe: true,
          }),
        ],
        lifeEvents: [lifeEvent("2012-04", "大学入学"), lifeEvent("1993-11-18", "生誕")],
      }),
    );

    const saved = await new D1ProfileQueryRepository(d1).find();
    expect(saved?.name.toString()).toBe("やんてね");
    expect(saved?.avatarUrl?.toString()).toBe("/api/v1/profile/assets/avatar.png");
    expect(saved?.socials.map((social) => social.platform)).toEqual(["github"]);
    // 保存の時点で日付順に並んでいるので、読み戻しても古い順のまま。
    expect(saved?.lifeEvents.map((event) => event.title)).toEqual(["生誕", "大学入学"]);
    expect(saved?.lifeEvents[0]?.date.toString()).toBe("1993-11-18");
    expect(saved?.lifeEvents[1]?.date.toString()).toBe("2012-04");
  });

  /** 子は差分を取らずに入れ直す。並べ替えたときに古い並びが残らないこと。 */
  it("replaces socials and life events instead of piling them up", async () => {
    const d1 = createTestD1();
    const command = new D1ProfileCommandRepository(d1);
    await command.upsert(
      unpersistedProfile({
        socials: [
          SocialAccount.create({
            platform: "github",
            url: "https://github.com/yantene",
            isMe: true,
          }),
          SocialAccount.create({ platform: "x", url: "https://x.com/yantene", isMe: false }),
        ],
        lifeEvents: [lifeEvent("1993-11-18", "生誕"), lifeEvent("2012-04", "大学入学")],
      }),
    );
    await command.upsert(
      unpersistedProfile({
        socials: [
          SocialAccount.create({
            platform: "bluesky",
            url: "https://bsky.app/profile/yantene.net",
            isMe: true,
          }),
        ],
        lifeEvents: [lifeEvent("1993-11-18", "生誕")],
      }),
    );

    const saved = await new D1ProfileQueryRepository(d1).find();
    expect(saved?.socials.map((social) => social.platform)).toEqual(["bluesky"]);
    expect(saved?.lifeEvents.map((event) => event.title)).toEqual(["生誕"]);
  });

  it("keeps created_at when the profile is written again", async () => {
    const d1 = createTestD1();
    const command = new D1ProfileCommandRepository(d1);
    await command.upsert(unpersistedProfile({}));
    const first = await new D1ProfileQueryRepository(d1).find();
    await command.upsert(unpersistedProfile({ name: "やんてね (改)" }));
    const second = await new D1ProfileQueryRepository(d1).find();

    expect(second?.name.toString()).toBe("やんてね (改)");
    expect(second?.createdAt.epochMilliseconds).toBe(first?.createdAt.epochMilliseconds);
  });

  it("deletes the profile and its children", async () => {
    const d1 = createTestD1();
    const command = new D1ProfileCommandRepository(d1);
    await command.upsert(
      unpersistedProfile({
        socials: [
          SocialAccount.create({
            platform: "github",
            url: "https://github.com/yantene",
            isMe: true,
          }),
        ],
        lifeEvents: [lifeEvent("1993-11-18", "生誕")],
      }),
    );
    await command.delete();

    const query = new D1ProfileQueryRepository(d1);
    expect(await query.find()).toBeUndefined();
    expect(await query.findSourceHash()).toBeUndefined();
    // 子の行が残っていると、次に入ったプロフィールに他人のライフイベントが混ざる。
    const rows = await d1.prepare("SELECT COUNT(*) AS n FROM profile_life_events").first<{
      n: number;
    }>();
    expect(rows?.n).toBe(0);
  });
});

describe("D1ProfileQueryRepository", () => {
  it("returns undefined before the first sync", async () => {
    const query = new D1ProfileQueryRepository(createTestD1());
    expect(await query.find()).toBeUndefined();
    expect(await query.findSourceHash()).toBeUndefined();
  });

  it("reads the source hash without building the profile", async () => {
    const d1 = createTestD1();
    await new D1ProfileCommandRepository(d1).upsert(unpersistedProfile({ sourceHash: "cafe1234" }));
    expect(await new D1ProfileQueryRepository(d1).findSourceHash()).toBe("cafe1234");
  });
});
