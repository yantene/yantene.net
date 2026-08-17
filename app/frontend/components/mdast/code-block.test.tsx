import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CodeBlock } from "./code-block";

const writeText = vi.fn<(text: string) => Promise<void>>();

beforeEach(() => {
  vi.useFakeTimers();
  writeText.mockReset();
  writeText.mockResolvedValue();
  vi.stubGlobal("navigator", { clipboard: { writeText } });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** ボタンを押して、クリップボードへの書き込みが片付くまで進める。 */
async function press(): Promise<void> {
  await act(async () => {
    screen.getByRole("button").click();
    await Promise.resolve();
  });
}

/** 偽の時計を進める。 */
function advance(ms: number): void {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

describe("CodeBlock", () => {
  it("押すと中身をクリップボードへ渡す", async () => {
    render(<CodeBlock>console.log(1);</CodeBlock>);

    await press();

    expect(writeText).toHaveBeenCalledWith("console.log(1);");
    expect(screen.getByRole("button")).toHaveTextContent("コピーしました");
  });

  it("しばらくすると表示が戻る", async () => {
    render(<CodeBlock>x</CodeBlock>);
    await press();

    advance(1500);

    expect(screen.getByRole("button")).toHaveTextContent("コピー");
    expect(screen.getByRole("button")).not.toHaveTextContent("コピーしました");
  });

  /*
   * 予定を片付けずに張り足していた頃の壊れ方 (#305)。
   *
   * 1 回目の予定が残っていると、2 回目を押した 100ms 後にそれが発火して表示が戻る。
   * コピー自体は成功しているのに、失敗したように見えていた。
   */
  it("押し直すと表示の時間も測り直す", async () => {
    render(<CodeBlock>x</CodeBlock>);
    await press();
    advance(1400);

    await press();
    // 1 回目の予定が残っていれば、ここで発火して表示が戻ってしまう。
    advance(100);

    expect(screen.getByRole("button")).toHaveTextContent("コピーしました");

    // 2 回目を基準に測り直されているので、そこから 1500ms で戻る。
    advance(1400);
    expect(screen.getByRole("button")).toHaveTextContent("コピー");
  });

  /*
   * 記事を移ると外れる。予定が残っていると、外れたコンポーネントの状態を触りに行く。
   */
  it("外れたら予定も片付ける", async () => {
    const { unmount } = render(<CodeBlock>x</CodeBlock>);
    await press();

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  it("クリップボードが使えなければ表示を変えない", async () => {
    writeText.mockRejectedValue(new Error("not allowed"));
    render(<CodeBlock>x</CodeBlock>);

    await press();

    expect(screen.getByRole("button")).toHaveTextContent("コピー");
    expect(screen.getByRole("button")).not.toHaveTextContent("コピーしました");
  });
});
