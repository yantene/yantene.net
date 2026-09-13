import type { IUnpersisted } from "~/backend/domain/shared";
import { describe, expect, it } from "vitest";
import { LifeEventDate } from "./life-event-date.vo";
import { LifeEvent } from "./life-event.vo";
import { ProfileName } from "./profile-name.vo";
import { Profile } from "./profile.entity";
import { Tagline } from "./tagline.vo";

function event(date: string, title: string): LifeEvent {
  return LifeEvent.create({ date: LifeEventDate.create(date), kind: "milestone", title });
}

function profileWith(lifeEvents: readonly LifeEvent[]): Profile<IUnpersisted> {
  return Profile.create({
    name: ProfileName.create("やんてね"),
    tagline: Tagline.create("東京で Web 開発者をやっています。"),
    socials: [],
    lifeEvents,
    sourceHash: "deadbeef",
  });
}

describe("Profile", () => {
  /*
   * 書き手が時系列で書くとは限らないので、並べるのは出す側の仕事。粒度が混ざっても
   * 正規化キーで比べるので、2012 年は 2012 年 4 月より前に来る。
   */
  it("orders life events from the oldest, whatever order they were written in", () => {
    const profile = profileWith([
      event("2016-04-01", "就職"),
      event("1993-11-18", "生誕"),
      event("2012-04", "大学入学"),
      event("2012", "その年のどこか"),
    ]);
    expect(profile.lifeEvents.map((e) => e.title)).toEqual([
      "生誕",
      "その年のどこか",
      "大学入学",
      "就職",
    ]);
  });

  /** 同じ日付のどちらが先かは日付から決められない。書いた順をそのまま残す。 */
  it("keeps the written order among events on the same date", () => {
    const profile = profileWith([event("2012-04", "入学"), event("2012-04", "上京")]);
    expect(profile.lifeEvents.map((e) => e.title)).toEqual(["入学", "上京"]);
  });
});
