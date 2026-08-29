import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShareMenu } from "./share-menu";
import { withI18n } from "~/frontend/lib/test-render";

const renderWithI18n = withI18n("en");

const url = "https://yantene.net/notes/hacku-2016";
const title = "記事の題";

/*
 * navigator ごと差し替える。丸ごと置き換わることで share が消えるので、共有シートを
 * 呼べない環境 (一覧が出る側) をそのまま再現できる。
 */
function stubClipboard(clipboard: Record<string, unknown>): void {
  vi.stubGlobal("navigator", { clipboard });
}

/** 実際に渡された ClipboardItem の中身を覗くための差し替え。 */
function stubClipboardItem(): readonly Record<string, Blob>[] {
  const recorded: Record<string, Blob>[] = [];

  vi.stubGlobal(
    "ClipboardItem",
    class {
      readonly types: readonly string[];

      constructor(items: Record<string, Blob>) {
        recorded.push(items);
        this.types = Object.keys(items);
      }
    },
  );

  return recorded;
}

/**
 * 共有シートを呼べない環境 (デスクトップの一部) の姿を確かめる。
 *
 * 呼べる環境の分岐は navigator.share の有無で決まり、判定そのものはブラウザに委ねている。
 * ここで見るのは「呼べないときに一覧とコピーが使えること」。
 */
describe("ShareMenu", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const renderMenu = (): void => {
    renderWithI18n(<ShareMenu url={url} title={title} />, { router: false });
  };

  it("offers every share target as a plain link", () => {
    renderMenu();

    expect(screen.getByRole("link", { name: "Share on X" })).toHaveAttribute(
      "href",
      expect.stringContaining("x.com/intent/post"),
    );
    expect(screen.getByRole("link", { name: "Share on Bluesky" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Share on Facebook" })).toBeInTheDocument();
  });

  /*
   * 貼り先が形式を選べるよう、2 つを同時に載せていること。どちらか片方に落ちると、
   * リッチな貼り先で URL が生のまま出たり、素の貼り先で HTML の文字列が出たりする。
   */
  it("puts both a rich link and a markdown link on the clipboard", async () => {
    const recorded = stubClipboardItem();
    const write = vi.fn().mockResolvedValue(undefined);
    stubClipboard({ write });

    renderMenu();
    await userEvent.click(screen.getByRole("button", { name: "Copy link" }));

    expect(write).toHaveBeenCalledOnce();
    const [item] = recorded;
    expect(Object.keys(item)).toEqual(["text/html", "text/plain"]);
    await expect(item["text/html"].text()).resolves.toBe(`<a href="${url}">${title}</a>`);
    await expect(item["text/plain"].text()).resolves.toBe(`[${title}](${url})`);
    expect(await screen.findByText("Copied")).toBeInTheDocument();
  });

  /* ClipboardItem を扱えない相手にも、せめて Markdown は置く。 */
  it("falls back to plain text where ClipboardItem is missing", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard({ writeText });
    vi.stubGlobal("ClipboardItem", undefined);

    renderMenu();
    await userEvent.click(screen.getByRole("button", { name: "Copy link" }));

    expect(writeText).toHaveBeenCalledWith(`[${title}](${url})`);
  });

  /* 失敗を黙って飲まない。押したのに何も起きない状態にしないこと。 */
  it("says so when the clipboard refuses", async () => {
    stubClipboard({
      write: vi.fn().mockRejectedValue(new Error("denied")),
      writeText: vi.fn().mockRejectedValue(new Error("denied")),
    });

    renderMenu();
    await userEvent.click(screen.getByRole("button", { name: "Copy link" }));

    expect(await screen.findByText("Couldn't copy")).toBeInTheDocument();
  });
});
