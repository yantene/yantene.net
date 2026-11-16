import { describe, expect, it } from "vitest";
import { InvalidProfileIdentityError, ProfileIdentity } from "./profile-identity.vo";

describe("ProfileIdentity", () => {
  it("holds nothing when nothing is written", () => {
    const identity = ProfileIdentity.empty();

    expect(identity.nameEn).toBeUndefined();
    expect(identity.familyName).toBeUndefined();
    expect(identity.givenName).toBeUndefined();
    expect(identity.alternateNames).toEqual([]);
    expect(identity.jobTitle).toBeUndefined();
    expect(identity.description).toBeUndefined();
    expect(identity.descriptionEn).toBeUndefined();
    expect(identity.toJSON()).toEqual({ alternateNames: [] });
  });

  it("trims each value and keeps the alternate names in the written order", () => {
    const identity = ProfileIdentity.create({
      nameEn: " Shuhei YOSHIDA ",
      familyName: "吉田",
      givenName: "周平",
      alternateNames: ["やんてね", " yantene "],
      jobTitle: "Web Developer",
      description: "吉田 周平の個人サイト。",
      descriptionEn: "Personal website of Shuhei YOSHIDA.",
    });

    expect(identity.nameEn).toBe("Shuhei YOSHIDA");
    expect(identity.alternateNames).toEqual(["やんてね", "yantene"]);
    expect(identity.toJSON()).toEqual({
      nameEn: "Shuhei YOSHIDA",
      familyName: "吉田",
      givenName: "周平",
      alternateNames: ["やんてね", "yantene"],
      jobTitle: "Web Developer",
      description: "吉田 周平の個人サイト。",
      descriptionEn: "Personal website of Shuhei YOSHIDA.",
    });
  });

  it("compares by value", () => {
    const one = ProfileIdentity.create({ nameEn: "Shuhei YOSHIDA", alternateNames: ["yantene"] });
    const same = ProfileIdentity.create({ nameEn: "Shuhei YOSHIDA", alternateNames: ["yantene"] });
    const other = ProfileIdentity.create({ nameEn: "Shuhei YOSHIDA" });

    expect(one.equals(same)).toBe(true);
    expect(one.equals(other)).toBe(false);
  });

  /*
   * どの欄も JSON-LD の 1 つの値や `<title>` にそのまま入る。空・長すぎ・改行入りは
   * 書き損じとして止める (同期はプロフィールごとスキップして前の姿を残す)。
   */
  it.each([
    ["空の英語名", { nameEn: "  " }],
    ["長すぎる肩書き", { jobTitle: "x".repeat(101) }],
    ["改行の入った説明文", { description: "1 行目\n2 行目" }],
    ["長すぎる説明文", { descriptionEn: "x".repeat(501) }],
    ["空の別名", { alternateNames: ["yantene", ""] }],
    ["同じ別名を 2 回", { alternateNames: ["yantene", "yantene"] }],
    [
      "多すぎる別名",
      { alternateNames: Array.from({ length: 21 }, (_, index) => `name-${String(index)}`) },
    ],
  ])("rejects %s", (_label, raw) => {
    expect(() => ProfileIdentity.create(raw)).toThrow(InvalidProfileIdentityError);
  });

  it("accepts a description up to 500 characters", () => {
    expect(ProfileIdentity.create({ description: "x".repeat(500) }).description).toHaveLength(500);
  });
});
