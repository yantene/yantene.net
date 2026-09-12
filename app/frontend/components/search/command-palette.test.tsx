import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CommandPalette } from "./command-palette";
import type { SearchArticles, SearchResult } from "./search-results";
import { withI18n } from "~/frontend/lib/test-render";

const renderWithI18n = withI18n();

const results: readonly SearchResult[] = [
  { slug: "alpha", title: "アルファ", summary: "はじめの記事。" },
  { slug: "bravo", title: "ブラボー", summary: "つぎの記事。" },
];

/*
 * 取り方はテストごとに固定して渡す。描画のたびに別物を渡すと、打っていないのに
 * 検索が投げ直され続ける (command-palette.tsx の `search` の注意)。
 */
const findAll: SearchArticles = () => Promise.resolve(results);
const findNothing: SearchArticles = () => Promise.resolve([]);
const alwaysFail: SearchArticles = () => Promise.reject(new Error("boom"));

function open(search: SearchArticles, onClose: () => void = () => undefined): void {
  renderWithI18n(<CommandPalette open onClose={onClose} search={search} />);
}

/** 入力欄に語を打つ。取りに行くまでの待ちは、結果が出るのを待って越える。 */
async function type(query: string): Promise<void> {
  await userEvent.type(screen.getByRole("combobox"), query);
}

describe("CommandPalette", () => {
  it("開いた直後は、何を探せる場所なのかだけを出す", () => {
    open(findAll);

    expect(screen.getByRole("status")).toHaveTextContent("記事の題と本文から探す。");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("打った語で探して、題と要約を並べる", async () => {
    open(findAll);
    await type("記事");

    await waitFor(() => {
      expect(screen.getAllByRole("option")).toHaveLength(2);
    });
    expect(screen.getByText("アルファ")).toBeInTheDocument();
    expect(screen.getByText("はじめの記事。")).toBeInTheDocument();
  });

  it("行はそのまま記事への導線になっている", async () => {
    open(findAll);
    await type("記事");

    await waitFor(() => {
      expect(screen.getAllByRole("option")[0]).toHaveAttribute("href", "/articles/alpha");
    });
  });

  /*
   * 焦点は入力欄に置いたまま、選ばれている行を aria-activedescendant で指す。
   * 行へ焦点を移す作りにすると、選ぶたびに字を打ち足せなくなる。
   */
  it("上下で選び直しても、焦点は入力欄に残る", async () => {
    open(findAll);
    const input = screen.getByRole("combobox");
    await type("記事");
    await waitFor(() => {
      expect(screen.getAllByRole("option")).toHaveLength(2);
    });

    expect(screen.getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true");

    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute("aria-activedescendant", screen.getAllByRole("option")[1].id);

    // 端まで来たら反対側へ回る。行き止まりにしない。
    await userEvent.keyboard("{ArrowDown}");
    expect(screen.getAllByRole("option")[0]).toHaveAttribute("aria-selected", "true");

    await userEvent.keyboard("{ArrowUp}");
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");
  });

  it("一致しなければ、そのことを出して一覧へ送り出す", async () => {
    open(findNothing);
    await type("みつからない");

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent("一致する記事がない。");
    });
    expect(screen.getByRole("link", { name: "すべての結果を見る" })).toHaveAttribute(
      "href",
      "/articles?q=%E3%81%BF%E3%81%A4%E3%81%8B%E3%82%89%E3%81%AA%E3%81%84",
    );
  });

  /*
   * 取りに行けなかったことは黙って飲み込まない。0 件と同じ顔にすると、
   * 「無い」のか「読めなかった」のかが読み手に伝わらない (fail-loud)。
   */
  it("取りに行けなければ、失敗したことを出す", async () => {
    open(alwaysFail);
    await type("記事");

    await waitFor(() => {
      expect(screen.getByRole("status")).toHaveTextContent(
        "検索できなかった。もう一度試してほしい。",
      );
    });
  });

  it("行を押したら閉じる", async () => {
    const onClose = vi.fn();
    open(findAll, onClose);
    await type("記事");
    await waitFor(() => {
      expect(screen.getAllByRole("option")).toHaveLength(2);
    });

    await userEvent.click(screen.getAllByRole("option")[0]);

    expect(onClose).toHaveBeenCalled();
  });
});
