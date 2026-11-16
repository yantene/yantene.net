import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HoverIntent } from "./hover-intent";

/*
 * 「出すまでの遅延」と「閉じやすさ」は、この機能でいちばん手を抜けないところ。
 * ホバーで出るものは、読み進めたい人には邪魔になる。
 */
describe("HoverIntent", () => {
  const onOpen = vi.fn<(subject: string) => void>();
  const onClose = vi.fn<() => void>();

  function intent(): HoverIntent<string> {
    return new HoverIntent<string>({ openDelayMs: 300, closeDelayMs: 150, onOpen, onClose });
  }

  beforeEach(() => {
    vi.useFakeTimers();
    onOpen.mockClear();
    onClose.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("opens only after the delay", () => {
    const hover = intent();
    hover.enter("a");

    vi.advanceTimersByTime(299);
    expect(onOpen).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onOpen).toHaveBeenCalledExactlyOnceWith("a");
  });

  it("never opens for a cursor that only passes over", () => {
    const hover = intent();
    hover.enter("a");
    vi.advanceTimersByTime(200);
    hover.leave();

    vi.advanceTimersByTime(1000);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("opens the link the cursor ended up on, not the one it crossed", () => {
    const hover = intent();
    hover.enter("a");
    vi.advanceTimersByTime(200);
    hover.leave();
    hover.enter("b");

    vi.advanceTimersByTime(300);
    expect(onOpen).toHaveBeenCalledExactlyOnceWith("b");
  });

  /*
   * 並んだ参照 (`[^1][^2]`) で起きる。前のチップを閉じる者が居なくなると、次のチップが
   * 出るまで前の中身が残り、次の相手が見えない記事なら離れるまで残り続ける。
   */
  it("still closes the previous chip when the cursor moves on to a neighbour", () => {
    const hover = intent();
    hover.enter("a");
    vi.advanceTimersByTime(300);
    hover.leave();
    hover.enter("b");

    vi.advanceTimersByTime(150);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps the chip when the cursor comes back to the link it left", () => {
    const hover = intent();
    hover.enter("a");
    vi.advanceTimersByTime(300);
    hover.leave();
    vi.advanceTimersByTime(100);
    hover.enter("a");

    vi.advanceTimersByTime(1000);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes shortly after leaving", () => {
    const hover = intent();
    hover.enter("a");
    vi.advanceTimersByTime(300);
    hover.leave();

    vi.advanceTimersByTime(149);
    expect(onClose).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stays open while the cursor moves onto the chip", () => {
    const hover = intent();
    hover.enter("a");
    vi.advanceTimersByTime(300);
    hover.leave();
    vi.advanceTimersByTime(100);
    hover.hold();

    vi.advanceTimersByTime(5000);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes after the cursor leaves the chip", () => {
    const hover = intent();
    hover.enter("a");
    vi.advanceTimersByTime(300);
    hover.leave();
    hover.hold();
    hover.release();

    vi.advanceTimersByTime(150);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("stays open when only the focus leaves while the cursor is on the chip", () => {
    // チップの中の字を選ぼうとして押すと、リンクから焦点が外れる。
    const hover = intent();
    hover.enter("a");
    vi.advanceTimersByTime(300);
    hover.hold();
    hover.leave();

    vi.advanceTimersByTime(5000);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("stays open when the cursor comes back to the link before the grace runs out", () => {
    const hover = intent();
    hover.enter("a");
    vi.advanceTimersByTime(300);
    hover.leave();
    vi.advanceTimersByTime(100);
    hover.enter("a");

    vi.advanceTimersByTime(5000);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("closes at once when dismissed", () => {
    const hover = intent();
    hover.enter("a");
    vi.advanceTimersByTime(300);
    hover.dismiss();

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not reopen a dismissed link while the cursor or the focus is still on it", () => {
    // Esc で閉じても、焦点はリンクに残っている。カーソルが少し動けば enter がまた来る。
    const hover = intent();
    hover.enter("a");
    vi.advanceTimersByTime(300);
    hover.dismiss();
    hover.enter("a");

    vi.advanceTimersByTime(5000);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("opens a dismissed link again once the reader has left it and come back", () => {
    const hover = intent();
    hover.enter("a");
    vi.advanceTimersByTime(300);
    hover.dismiss();
    hover.leave();
    hover.enter("a");

    vi.advanceTimersByTime(300);
    expect(onOpen).toHaveBeenCalledTimes(2);
  });

  it("cancels the pending open when dismissed before the delay", () => {
    // 待っている間にリンクを押した。遷移の途中でチップを出さない。
    const hover = intent();
    hover.enter("a");
    vi.advanceTimersByTime(100);
    hover.dismiss();

    vi.advanceTimersByTime(5000);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it("tells whether the reader still wants a link, for content that arrives late", () => {
    const hover = intent();
    hover.enter("a");
    vi.advanceTimersByTime(300);
    expect(hover.wants("a")).toBe(true);

    hover.leave();
    expect(hover.wants("a")).toBe(false);
  });

  it("drops pending timers when disposed", () => {
    const hover = intent();
    hover.enter("a");
    hover.dispose();

    vi.advanceTimersByTime(5000);
    expect(onOpen).not.toHaveBeenCalled();
  });
});
