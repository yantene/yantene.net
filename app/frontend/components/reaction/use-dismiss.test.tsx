import { act, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { useDismiss } from "./use-dismiss";
import type { DismissReason } from "./use-dismiss";

/** 開閉するものの最小形。入口と中身を 1 つの範囲に収める、本物と同じ形にする。 */
function Popover({
  onDismiss,
}: {
  readonly onDismiss: (reason: DismissReason) => void;
}): React.JSX.Element {
  const [isOpen, setOpen] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useDismiss({
    isOpen,
    containerRef,
    onDismiss: (reason) => {
      setOpen(false);
      onDismiss(reason);
    },
  });

  return (
    <div>
      <div ref={containerRef}>
        <button type="button" onClick={() => setOpen(!isOpen)}>
          入口
        </button>
        {isOpen && (
          <div>
            <input aria-label="絞り込み" />
          </div>
        )}
      </div>
      <button type="button">外側</button>
    </div>
  );
}

/*
 * 素の DOM イベントとして投げる。フックが購読しているのは React の合成イベントでは
 * なく document の listener なので、そこを実際に通す必要がある。
 *
 * act で包むのは、React の外から起きた state 更新を描画まで流し込むため。
 */
function pointerDown(element: Element): void {
  act(() => {
    element.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
  });
}

function pressKey(key: string): void {
  act(() => {
    globalThis.dispatchEvent(new KeyboardEvent("keydown", { key }));
  });
}

describe("useDismiss", () => {
  it("外側を押すと閉じる", () => {
    const onDismiss = vi.fn();
    render(<Popover onDismiss={onDismiss} />);

    pointerDown(screen.getByRole("button", { name: "外側" }));

    expect(onDismiss).toHaveBeenCalledWith("outside");
    expect(screen.queryByLabelText("絞り込み")).toBeNull();
  });

  it("Esc で閉じる", () => {
    const onDismiss = vi.fn();
    render(<Popover onDismiss={onDismiss} />);

    pressKey("Escape");

    expect(onDismiss).toHaveBeenCalledWith("escape");
    expect(screen.queryByLabelText("絞り込み")).toBeNull();
  });

  it("中身を押しても閉じない", () => {
    const onDismiss = vi.fn();
    render(<Popover onDismiss={onDismiss} />);

    pointerDown(screen.getByLabelText("絞り込み"));

    expect(onDismiss).not.toHaveBeenCalled();
    expect(screen.getByLabelText("絞り込み")).toBeTruthy();
  });

  it("入口そのものを押しても閉じない (入口自身のトグルに任せる)", () => {
    const onDismiss = vi.fn();
    render(<Popover onDismiss={onDismiss} />);

    pointerDown(screen.getByRole("button", { name: "入口" }));

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("Esc 以外のキーでは閉じない", () => {
    const onDismiss = vi.fn();
    render(<Popover onDismiss={onDismiss} />);

    pressKey("Enter");
    pressKey("a");

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("閉じたあとは見張らない", () => {
    const onDismiss = vi.fn();
    render(<Popover onDismiss={onDismiss} />);

    pressKey("Escape");
    onDismiss.mockClear();
    pointerDown(screen.getByRole("button", { name: "外側" }));

    expect(onDismiss).not.toHaveBeenCalled();
  });
});
