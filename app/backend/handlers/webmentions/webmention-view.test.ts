import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { toWebmentionGroups, toWebmentionView } from "./webmention-view";
import { NoteSlug } from "~/backend/domain/note";
import { entityId } from "~/backend/domain/shared";
import {
  Webmention,
  WebmentionAuthor,
  WebmentionContent,
  WebmentionType,
  WebmentionUrl,
} from "~/backend/domain/webmention";

const receivedAt = Temporal.Instant.from("2026-08-10T00:00:00Z");

function mention(params: {
  id: string;
  type: string;
  avatar?: string;
  publishedAt?: Temporal.Instant;
  content?: string;
}): Webmention {
  return Webmention.reconstruct({
    id: entityId<"Webmention">(params.id),
    noteId: entityId<"Note">("note-1"),
    target: NoteSlug.create("hello"),
    source: WebmentionUrl.create(`https://example.com/${params.id}`),
    type: WebmentionType.create(params.type),
    author: WebmentionAuthor.reconstruct({
      name: "だれか",
      url: "https://example.com/",
      photo: "https://example.com/face.png",
    }),
    authorAvatar: params.avatar,
    content:
      params.content === undefined
        ? undefined
        : WebmentionContent.reconstruct(params.content),
    publishedAt: params.publishedAt,
    receivedAt,
    updatedAt: receivedAt,
  });
}

describe("toWebmentionView", () => {
  it("アイコンは自分の配信 URL を指す", () => {
    const view = toWebmentionView(
      mention({ id: "a", type: "like", avatar: "a".repeat(32) }),
    );
    expect(view.authorAvatarUrl).toBe(
      `/api/v1/webmentions/avatars/${"a".repeat(32)}`,
    );
  });

  it("写せていなければアイコンは null (相手の URL は出さない)", () => {
    const view = toWebmentionView(mention({ id: "a", type: "like" }));
    expect(view.authorAvatarUrl).toBeNull();
  });

  it("公開日時が読めていなければ受信時刻で代える", () => {
    const view = toWebmentionView(mention({ id: "a", type: "reply" }));
    expect(view.publishedAt).toBe(receivedAt.toString());
  });

  it("公開日時が読めていればそれを使う", () => {
    const published = Temporal.Instant.from("2026-08-01T12:00:00Z");
    const view = toWebmentionView(
      mention({ id: "a", type: "reply", publishedAt: published }),
    );
    expect(view.publishedAt).toBe(published.toString());
  });
});

describe("toWebmentionGroups", () => {
  it("顔だけ並べるものと本文を読ませるものに分ける", () => {
    const groups = toWebmentionGroups([
      mention({ id: "1", type: "like" }),
      mention({ id: "2", type: "reply", content: "なるほど" }),
      mention({ id: "3", type: "repost" }),
      mention({ id: "4", type: "mention" }),
    ]);

    expect(groups.faces.map((view) => view.type)).toEqual(["like", "repost"]);
    expect(groups.replies.map((view) => view.type)).toEqual([
      "reply",
      "mention",
    ]);
  });

  it("1 件も無ければどちらも空", () => {
    const groups = toWebmentionGroups([]);
    expect(groups.faces).toEqual([]);
    expect(groups.replies).toEqual([]);
  });
});
