import type { Profile as ProfileEntity } from "~/backend/domain/profile";
import type { IUnpersisted } from "~/backend/domain/shared";
import { getTableColumns } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import {
  D1_BOUND_PARAMETER_LIMIT,
  D1ProfileCommandRepository,
  HISTORY_ROWS_PER_STATEMENT,
  SOCIAL_ROWS_PER_STATEMENT,
} from "./profile.command-repository";
import { D1ProfileQueryRepository } from "./profile.query-repository";
import {
  HistoryEntry,
  Profile,
  ProfileName,
  SocialAccount,
  Tagline,
} from "~/backend/domain/profile";
import { profileHistory, profileSocials } from "~/backend/infra/d1/schema";
import { createTestD1 } from "~/backend/infra/d1/test-helper";

function unpersistedProfile(params: {
  name?: string;
  tagline?: string;
  socials?: readonly SocialAccount[];
  history?: readonly HistoryEntry[];
  sourceHash?: string;
}): ProfileEntity<IUnpersisted> {
  return Profile.create({
    name: ProfileName.create(params.name ?? "やんてね"),
    tagline: Tagline.create(params.tagline ?? "東京で Web 開発者をやっています。"),
    socials: params.socials ?? [],
    history: params.history ?? [],
    sourceHash: params.sourceHash ?? "deadbeef",
  });
}

/**
 * ⚠️ **1 文あたりのパラメータ数が D1 の上限を超えていないこと。**
 *
 * 超えると insert 1 文ではなく **batch ごと**落ちるので、経歴だけでなくプロフィールの
 * 同期まるごとが止まる。**手元では踏めない** (`createTestD1` は node:sqlite で、あちらの
 * 上限は 32766)。だから「動かして確かめる」ができず、数で見張るしかない。
 *
 * 列の数は schema から数える。**欄を 1 つ足したら、行数を切り直すまでここが落ちる。**
 */
describe("D1 のバインドパラメータ上限", () => {
  it.each([
    ["profile_socials", profileSocials, SOCIAL_ROWS_PER_STATEMENT],
    ["profile_history", profileHistory, HISTORY_ROWS_PER_STATEMENT],
  ])("%s は 1 文が上限に収まる", (_label, table, rowsPerStatement) => {
    const columns = Object.keys(getTableColumns(table)).length;

    expect(columns * rowsPerStatement).toBeLessThanOrEqual(D1_BOUND_PARAMETER_LIMIT);
  });
});

describe("D1ProfileCommandRepository", () => {
  it("inserts the profile with its socials", async () => {
    const d1 = createTestD1();
    await new D1ProfileCommandRepository(d1).upsert(
      unpersistedProfile({
        socials: [
          SocialAccount.create({
            platform: "github",
            url: "https://github.com/yantene",
            isMe: true,
          }),
        ],
      }),
    );

    const saved = await new D1ProfileQueryRepository(d1).find();
    expect(saved?.name.toString()).toBe("やんてね");
    expect(saved?.socials.map((social) => social.platform)).toEqual(["github"]);
  });

  /** 子は差分を取らずに入れ直す。並べ替えたときに古い並びが残らないこと。 */
  it("replaces socials instead of piling them up", async () => {
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
      }),
    );

    const saved = await new D1ProfileQueryRepository(d1).find();
    expect(saved?.socials.map((social) => social.platform)).toEqual(["bluesky"]);
  });

  /**
   * 経歴は書いた順 (`position`) のまま戻ること。任意の欄は書いていなければ undefined。
   *
   * 章を各行が持つ平らな並びで保存しているので、章に畳み直すのは出す側の仕事。ここで
   * 見るのは「並びが崩れないこと」と「null が undefined に戻ること」の 2 つ。
   */
  it("inserts the history in the written order", async () => {
    const d1 = createTestD1();
    await new D1ProfileCommandRepository(d1).upsert(
      unpersistedProfile({
        history: [
          HistoryEntry.create({ chapter: "高校", year: 2012, month: 3, text: "卒業" }),
          HistoryEntry.create({
            chapter: "大学",
            year: 2012,
            text: "入学",
            url: "https://example.com/",
            note: "補足",
          }),
        ],
      }),
    );

    const saved = await new D1ProfileQueryRepository(d1).find();
    expect(saved?.history.map((entry) => [entry.chapter, entry.year, entry.text])).toEqual([
      ["高校", 2012, "卒業"],
      ["大学", 2012, "入学"],
    ]);
    expect(saved?.history[0]?.month).toBe(3);
    expect(saved?.history[0]?.url).toBeUndefined();
    expect(saved?.history[0]?.note).toBeUndefined();
    /* 書いていない月は null で入り、undefined に戻る (0 や空文字に倒さない)。 */
    expect(saved?.history[1]?.month).toBeUndefined();
    expect(saved?.history[1]?.url).toBe("https://example.com/");
    expect(saved?.history[1]?.note).toBe("補足");
  });

  /*
   * 上限を超える件数でも、切った文をまたいで並びが崩れないこと。
   *
   * ⚠️ **これは上限そのものの検査ではない** (node:sqlite は何行でも通すので、切るのを
   * やめてもここは緑のまま)。上限は「D1 のバインドパラメータ上限」の describe が数で見る。
   * ここで見るのは、切ったせいで行が落ちたり順が入れ替わったりしないこと。
   */
  it("keeps the order across statement chunks", async () => {
    const d1 = createTestD1();
    const entries = Array.from({ length: HISTORY_ROWS_PER_STATEMENT * 2 + 1 }, (_unused, index) =>
      HistoryEntry.create({
        chapter: "社会人",
        year: 2000 + index,
        text: `出来事 ${String(index)}`,
      }),
    );
    await new D1ProfileCommandRepository(d1).upsert(unpersistedProfile({ history: entries }));

    const saved = await new D1ProfileQueryRepository(d1).find();
    expect(saved?.history.map((entry) => entry.text)).toEqual(entries.map((entry) => entry.text));
  });

  /** 子は差分を取らずに入れ直す。経歴も出ていく先と同じ扱いであること。 */
  it("replaces the history instead of piling it up", async () => {
    const d1 = createTestD1();
    const command = new D1ProfileCommandRepository(d1);
    await command.upsert(
      unpersistedProfile({
        history: [
          HistoryEntry.create({ chapter: "高校", year: 2011, text: "入学" }),
          HistoryEntry.create({ chapter: "高校", year: 2012, text: "卒業" }),
        ],
      }),
    );
    await command.upsert(
      unpersistedProfile({
        history: [HistoryEntry.create({ chapter: "社会人", year: 2018, text: "就職" })],
      }),
    );

    const saved = await new D1ProfileQueryRepository(d1).find();
    expect(saved?.history.map((entry) => entry.text)).toEqual(["就職"]);
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
        history: [HistoryEntry.create({ chapter: "高校", year: 2012, text: "卒業" })],
      }),
    );
    await command.delete();

    const query = new D1ProfileQueryRepository(d1);
    expect(await query.find()).toBeUndefined();
    expect(await query.findSourceHash()).toBeUndefined();
    /*
     * 子の行が残っていると、次に入ったプロフィールに古い出ていく先と経歴が混ざる。
     * **D1 は FK を既定で強制しない**ので、cascade に任せず消していることを見る。
     */
    for (const table of ["profile_socials", "profile_history"]) {
      const rows = await d1.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>();
      expect(rows?.n).toBe(0);
    }
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
