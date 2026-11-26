import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ShareBar } from "./share-bar";
import { withI18n } from "~/frontend/lib/test-render";

const renderWithI18n = withI18n("en");

const url = "https://yantene.net/articles/hacku-2016";
const title = "記事の題";

/*
 * navigator ごと差し替える。丸ごと置き換わることで share が消えるので、共有シートを
 * 呼べない環境 (共有シートの押し場所が出ない側) をそのまま再現できる。
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
 * 共有の帯の中身を確かめる。
 *
 * 呼べる環境の分岐は navigator.share の有無で決まり、判定そのものはブラウザに委ねている。
 * ここで見るのは「共有先とコピーが常に並び、共有シートは呼べるときだけ足されること」。
 */
describe("ShareBar", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const renderBar = (): void => {
    renderWithI18n(<ShareBar url={url} title={title} />, { router: false });
  };

  it("offers every share target as a plain link", () => {
    renderBar();

    expect(screen.getByRole("link", { name: "Share on X" })).toHaveAttribute(
      "href",
      expect.stringContaining("x.com/intent/post"),
    );
    for (const service of ["Facebook", "Bluesky", "Mastodon", "Threads", "Hatena Bookmark"]) {
      expect(screen.getByRole("link", { name: `Share on ${service}` })).toBeInTheDocument();
    }
  });

  /*
   * 印だけで字を出さないので、名前は aria-label と title で持つ。どちらかが欠けると、
   * 読み上げかマウスの読み手のどちらかが行き先を知る手立てを失う。
   */
  it("names each icon-only control for screen readers and pointer users", () => {
    renderBar();

    const x = screen.getByRole("link", { name: "Share on X" });
    expect(x).toHaveAttribute("title", "Share on X");
    expect(x).toHaveTextContent("");
    expect(screen.getByRole("button", { name: "Copy link" })).toHaveAttribute("title", "Copy link");
  });

  it("leaves out the system share sheet where the browser has none", () => {
    stubClipboard({});
    renderBar();
    expect(screen.queryByRole("button", { name: "Share via other apps" })).toBeNull();
  });

  it("hands the article to the system share sheet when it exists", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { clipboard: {}, share });

    renderBar();
    await userEvent.click(screen.getByRole("button", { name: "Share via other apps" }));

    expect(share).toHaveBeenCalledWith({ title, url });
  });

  /*
   * 黒を許さない社の印だけが色のクラスを持つ (ADR 0052)。ほかに色を付けると、Bluesky の
   * 「他の SNS の印と並べるときは単色に」に当たる。
   */
  it("colors only the marks whose brands forbid black", () => {
    renderBar();

    const markOf = (service: string): Element | null =>
      screen.getByRole("link", { name: `Share on ${service}` }).querySelector("svg");

    expect(markOf("Facebook")).toHaveClass("brand-mark", "brand-mark-facebook");
    expect(markOf("Hatena Bookmark")).toHaveClass("brand-mark", "brand-mark-hatena-bookmark");
    for (const service of ["X", "Bluesky", "Mastodon", "Threads"]) {
      expect(markOf(service)?.getAttribute("class")).toBe("brand-mark");
    }
  });

  /*
   * 貼り先が形式を選べるよう、2 つを同時に載せていること。どちらか片方に落ちると、
   * リッチな貼り先で URL が生のまま出たり、素の貼り先で HTML の文字列が出たりする。
   */
  it("puts both a rich link and a markdown link on the clipboard", async () => {
    const recorded = stubClipboardItem();
    const write = vi.fn().mockResolvedValue(undefined);
    stubClipboard({ write });

    renderBar();
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

    renderBar();
    await userEvent.click(screen.getByRole("button", { name: "Copy link" }));

    expect(writeText).toHaveBeenCalledWith(`[${title}](${url})`);
  });

  /* 失敗を黙って飲まない。押したのに何も起きない状態にしないこと。 */
  it("says so when the clipboard refuses", async () => {
    stubClipboard({
      write: vi.fn().mockRejectedValue(new Error("denied")),
      writeText: vi.fn().mockRejectedValue(new Error("denied")),
    });

    renderBar();
    await userEvent.click(screen.getByRole("button", { name: "Copy link" }));

    expect(await screen.findByText("Couldn't copy")).toBeInTheDocument();
  });
});
