import { fireEvent, render, screen } from "@testing-library/react";
import { I18nextProvider } from "react-i18next";
import { beforeAll, describe, expect, it } from "vitest";
import { WebmentionList } from "./webmention-list";
import type { i18n } from "i18next";
import type {
  WebmentionView,
  WebmentionGroups,
} from "~/backend/handlers/webmentions/webmention-view";
import { createI18nInstance } from "~/lib/i18n/init";

const i18nRef: { current: i18n | undefined } = { current: undefined };

function renderList(webmentions: WebmentionGroups): void {
  const instance = i18nRef.current;
  if (instance === undefined) throw new Error("i18n is not ready");
  render(
    <I18nextProvider i18n={instance}>
      <WebmentionList webmentions={webmentions} />
    </I18nextProvider>,
  );
}

function mention(overrides: Partial<WebmentionView>): WebmentionView {
  return {
    id: "1",
    type: "reply",
    source: "https://example.com/posts/1",
    authorName: "だれか",
    authorUrl: "https://example.com/",
    authorAvatarUrl: null,
    content: null,
    publishedAt: "2026-08-01T00:00:00Z",
    ...overrides,
  };
}

describe("WebmentionList", () => {
  beforeAll(async () => {
    i18nRef.current = await createI18nInstance("ja");
  });

  it("1 件も無ければ何も描かない", () => {
    const { container } = render(<WebmentionList webmentions={{ faces: [], replies: [] }} />);
    expect(container.innerHTML).toBe("");
  });

  it("いいねとリポストは顔として並べる", () => {
    renderList({
      faces: [mention({ id: "f1", type: "like", authorName: "あかり" })],
      replies: [],
    });
    expect(screen.getByTitle("あかり")).toBeTruthy();
  });

  it("アイコンが写せていなければ頭文字を出す", () => {
    renderList({
      faces: [mention({ id: "f1", type: "like", authorName: "あかり" })],
      replies: [],
    });
    const initial = document.querySelector(":scope .webmention-face-initial");
    expect(initial?.textContent).toBe("あ");
  });

  it("アイコンが写せていれば自分のところから読む", () => {
    renderList({
      faces: [
        mention({
          id: "f1",
          type: "like",
          authorAvatarUrl: "/api/v1/webmentions/avatars/abc",
        }),
      ],
      replies: [],
    });
    const photo = document.querySelector(":scope .webmention-face-photo");
    expect(photo?.getAttribute("src")).toBe("/api/v1/webmentions/avatars/abc");
  });

  /*
   * 0 バイトの写しが入ってしまった顔がある。写すのは送り手が再送してきたときだけで、
   * 期限で取り直す仕組みが顔には無いので、放っておいても直らない (#322)。
   * 配信を 404 にしても同じ壊れた図が出るので、描画側で受けて代わりに倒す。
   */
  it("アイコンが読めなければ頭文字に倒す", () => {
    renderList({
      faces: [
        mention({
          id: "f1",
          type: "like",
          authorName: "あかり",
          authorAvatarUrl: "/api/v1/webmentions/avatars/broken",
        }),
      ],
      replies: [],
    });
    const photo = document.querySelector(":scope .webmention-face-photo");
    expect(photo).not.toBeNull();

    fireEvent.error(photo as Element);

    expect(document.querySelector(":scope .webmention-face-photo")).toBeNull();
    const initial = document.querySelector(":scope .webmention-face-initial");
    expect(initial?.textContent).toBe("あ");
  });

  it("返信のアイコンが読めなければ名前だけにする", () => {
    renderList({
      faces: [],
      replies: [
        mention({
          id: "r1",
          authorName: "あかり",
          authorAvatarUrl: "/api/v1/webmentions/avatars/broken",
        }),
      ],
    });
    const photo = document.querySelector(":scope .webmention-reply-photo");
    expect(photo).not.toBeNull();

    fireEvent.error(photo as Element);

    expect(document.querySelector(":scope .webmention-reply-photo")).toBeNull();
    expect(screen.getByText("あかり")).toBeTruthy();
  });

  it("返信は本文と出典を出す", () => {
    renderList({
      faces: [],
      replies: [mention({ id: "r1", content: "なるほど" })],
    });
    expect(screen.getByText("なるほど")).toBeTruthy();
    const source = document.querySelector(":scope .webmention-reply-source");
    expect(source?.getAttribute("href")).toBe("https://example.com/posts/1");
  });

  it("名乗っていなければ出どころのホスト名で代える", () => {
    renderList({
      faces: [],
      replies: [mention({ id: "r1", authorName: null, authorUrl: null })],
    });
    expect(screen.getByText("example.com")).toBeTruthy();
  });

  it("パーサ向けに microformats2 を出す", () => {
    renderList({
      faces: [],
      replies: [mention({ id: "r1", content: "なるほど" })],
    });
    // h-cite / h-card / p-content / dt-published が揃っていれば、誰の何への言及かを辿れる。
    expect(document.querySelector(":scope .h-cite")).toBeTruthy();
    expect(document.querySelector(":scope .h-card.p-author")).toBeTruthy();
    expect(document.querySelector(":scope .p-content")?.textContent).toBe("なるほど");
    expect(document.querySelector(":scope .dt-published")?.getAttribute("datetime")).toBe(
      "2026-08-01T00:00:00Z",
    );
  });

  it("外部リンクは別タブで開き、安全な rel を付ける", () => {
    renderList({
      faces: [],
      replies: [mention({ id: "r1" })],
    });
    const source = document.querySelector(":scope .webmention-reply-source");
    expect(source?.getAttribute("target")).toBe("_blank");
    expect(source?.getAttribute("rel")).toContain("noopener");
  });
});
