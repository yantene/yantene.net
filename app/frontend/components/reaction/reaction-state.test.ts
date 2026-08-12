import { describe, expect, it } from "vitest";
import { withPendingReaction } from "./reaction-state";

const empty = { reactions: [], mine: null };

describe("withPendingReaction", () => {
  it("初めて押すと、その絵文字が 1 で現れる", () => {
    expect(withPendingReaction(empty, "❤️")).toEqual({
      reactions: [{ emoji: "❤️", count: 1 }],
      mine: "❤️",
    });
  });

  it("すでに押されている絵文字なら数だけ増える", () => {
    const current = { reactions: [{ emoji: "❤️", count: 3 }], mine: null };

    expect(withPendingReaction(current, "❤️")).toEqual({
      reactions: [{ emoji: "❤️", count: 4 }],
      mine: "❤️",
    });
  });

  /* 1 ノートにつき 1 つなので、押すことは「いまの 1 つを置き換える」こと。 */
  it("差し替えると、旧が減って新が増える", () => {
    const current = {
      reactions: [
        { emoji: "❤️", count: 3 },
        { emoji: "🎉", count: 1 },
      ],
      mine: "❤️",
    };

    expect(withPendingReaction(current, "🎉")).toEqual({
      reactions: [
        { emoji: "❤️", count: 2 },
        { emoji: "🎉", count: 2 },
      ],
      mine: "🎉",
    });
  });

  it("取り消すと数が減り、自分の印が外れる", () => {
    const current = { reactions: [{ emoji: "❤️", count: 3 }], mine: "❤️" };

    expect(withPendingReaction(current, null)).toEqual({
      reactions: [{ emoji: "❤️", count: 2 }],
      mine: null,
    });
  });

  /* 0 になった絵文字は並べない。サーバーの一覧も 0 を返さない。 */
  it("最後のひとつを取り消すと並びから消える", () => {
    const current = { reactions: [{ emoji: "❤️", count: 1 }], mine: "❤️" };

    expect(withPendingReaction(current, null)).toEqual({
      reactions: [],
      mine: null,
    });
  });

  it("同じものを押し直しても何も変わらない", () => {
    const current = { reactions: [{ emoji: "❤️", count: 1 }], mine: "❤️" };

    expect(withPendingReaction(current, "❤️")).toBe(current);
  });

  /*
   * 並び順はサーバーと揃える。ずれていると、送信中と応答後で並びが入れ替わって見える。
   */
  it("多い順、同数なら絵文字の昇順に並べる", () => {
    const current = {
      reactions: [
        { emoji: "🎉", count: 1 },
        { emoji: "❤️", count: 1 },
      ],
      mine: null,
    };

    expect(withPendingReaction(current, "👍").reactions).toEqual([
      { emoji: "❤️", count: 1 },
      { emoji: "🎉", count: 1 },
      { emoji: "👍", count: 1 },
    ]);
  });
});
