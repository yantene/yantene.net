import { describe, expect, it } from "vitest";
import { InvalidReactionEmojiError, ReactionEmoji } from "./reaction-emoji.vo";

describe("ReactionEmoji", () => {
  it("一覧にある絵文字を受け入れる", () => {
    expect(ReactionEmoji.create("🎉").toString()).toBe("🎉");
  });

  it("既定のいいねはハート", () => {
    expect(ReactionEmoji.like().toString()).toBe("❤️");
  });

  /*
   * バリエーションは持たせない方針なので、派生は一覧に無く、ここで落ちる。
   * 「知らないものは既定に倒す」ようなことはしない (押した本人に見えている絵文字と、
   * 記録される絵文字が食い違う)。
   */
  it.each([
    ["肌の色付き", "👍🏽"],
    ["髪の色付き", "🧑‍🦰"],
    ["肌の色の修飾子そのもの", "🏽"],
    ["地域指標文字 (旗の部品)", "🇦"],
    ["絵文字でない文字列", "hello"],
    ["空文字", ""],
    ["絵文字の並び", "❤️❤️"],
  ])("%s は受け付けない", (_name, raw) => {
    expect(() => ReactionEmoji.create(raw)).toThrow(InvalidReactionEmojiError);
  });

  /*
   * 異体字セレクタ (U+FE0F) の有無で表記が揺れる。一覧の形だけを通すこと。揺れたまま
   * 通すと、同じ絵文字が別々の行に積まれて数が割れる。
   */
  it("異体字セレクタを欠いたハートは受け付けない", () => {
    expect(() => ReactionEmoji.create("❤")).toThrow(InvalidReactionEmojiError);
  });

  it("同じ絵文字どうしは等しい", () => {
    expect(ReactionEmoji.create("🎉").equals(ReactionEmoji.create("🎉"))).toBe(true);
    expect(ReactionEmoji.create("🎉").equals(ReactionEmoji.like())).toBe(false);
  });
});
