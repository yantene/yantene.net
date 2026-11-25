import { useLayoutEffect, useRef } from "react";

export interface PreviewChipProps {
  /** 引き金のリンクが `aria-describedby` で指す名札。 */
  readonly id: string;
  /** カーソルがチップに乗った。乗っている間は閉じない。 */
  readonly onPointerEnter?: () => void;
  readonly onPointerLeave?: () => void;
  readonly children: React.ReactNode;
}

/**
 * リンクの脇に出るチップの器。
 *
 * **位置は CSS が決める** (preview.css)。Popover API で最前面に出し、錨の印
 * (`data-preview-anchor`) が付いたリンクへ CSS anchor positioning で寄せる。
 * ここで `top` / `left` を計算して書き込むことはしない (`style` 属性を書かない規約)。
 *
 * `popover="manual"` にしているのは、出し入れをホバーの都合で決めたいため。`auto` は
 * 出した時点でほかの popover を閉じてしまう。そのぶん Esc で閉じるのは持ち主
 * (PreviewLayer) の仕事になる。
 *
 * 画面に入った時点で開く。閉じるときは要素ごと外れる。
 *
 * **支援技術には「リンクの説明」として渡す** (`role="tooltip"`)。開いている間だけ、
 * 引き金のリンクが `aria-describedby` でこの id を指す (preview-context.ts)。リンクを
 * 押せば行き先へ移るので、`aria-expanded` は付けない。「折りたたまれている」と読まれると、
 * Enter で開くものだと受け取られる。中身はリンク先へ行けば読めるもので、読み飛ばされて
 * 困るものは置かない。
 */
export function PreviewChip({
  id,
  onPointerEnter,
  onPointerLeave,
  children,
}: PreviewChipProps): React.JSX.Element {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    ref.current?.showPopover();
  }, []);

  return (
    <div
      ref={ref}
      id={id}
      role="tooltip"
      popover="manual"
      className="preview-chip"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {children}
    </div>
  );
}
