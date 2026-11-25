import { createContext, useContext, useState } from "react";

/** プレビューを出す相手。 */
export type PreviewTarget =
  | { readonly kind: "footnote"; readonly id: string }
  | { readonly kind: "article"; readonly slug: string };

/** 本文のリンクが、プレビューの持ち主 (PreviewLayer) に頼めること。 */
export interface PreviewController {
  /** いまチップが指しているリンク。チップの位置合わせの錨になる。 */
  readonly anchor: Element | null;
  /** チップの id。チップが指しているリンクだけが `aria-describedby` でこれを指す。 */
  readonly chipId: string;
  /** リンクに乗った・焦点が当たった。 */
  readonly intend: (target: PreviewTarget, element: Element) => void;
  /** リンクから離れた。 */
  readonly relent: () => void;
  /** いますぐ閉じる。 */
  readonly dismiss: () => void;
  /**
   * 脚注をドロワーで開く。開けたら true。
   *
   * 開けなかったら (その脚注が無い・`<dialog>` が使えない) 呼んだ側は何もせず、
   * リンクはいつもどおり `#fn-1` へ飛ぶ。
   */
  readonly openDrawer: (id: string) => boolean;
}

/**
 * プレビューの持ち主。**無ければ、リンクは素のリンクのまま振る舞う。**
 *
 * 無い場所は 2 つある。PreviewLayer の外 (Storybook で部品だけを描いたとき) と、
 * チップ・ドロワーの中身。後者は意図して外している — チップの中のリンクから
 * 更にチップを出すと、どこまでも入れ子になって閉じ方が分からなくなる。
 */
export const PreviewContext = createContext<PreviewController | null>(null);

/**
 * ホバーでプレビューを出す環境か。
 *
 * **描画の途中では呼ばない。** サーバーは読み手の入力手段を知らないので、描き分けに
 * 使うと hydration で食い違う。出来事のハンドラの中 (読み手が実際に触ったとき) でだけ問う。
 */
export function prefersHover(): boolean {
  return globalThis.matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/** リンクに足す属性。**何も起きていない間は、素のリンクに何も足さない。** */
export interface PreviewTriggerProps {
  readonly onPointerEnter: (event: React.PointerEvent<HTMLAnchorElement>) => void;
  readonly onPointerLeave: () => void;
  readonly onFocus: (event: React.FocusEvent<HTMLAnchorElement>) => void;
  readonly onBlur: () => void;
  /** チップがこのリンクを指している間だけ付く。CSS がここに錨の名前を置く (preview.css)。 */
  readonly "data-preview-anchor"?: "";
}

/** 修飾キーつき・主ボタン以外のクリックか。新しいタブで開くなど、ブラウザに任せる押し方。 */
function isModifiedClick(event: React.MouseEvent): boolean {
  return event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;
}

/**
 * 脚注の参照を押したとき、ページ内ジャンプの代わりにドロワーを開くべきか。
 *
 * ホバーできる環境ではチップがあるので、押したら今までどおり脚注へ飛ぶ。
 */
function opensDrawerOn(event: React.MouseEvent): boolean {
  return !event.defaultPrevented && !isModifiedClick(event) && !prefersHover();
}

export interface PreviewTrigger {
  /** リンクにそのまま広げる。 */
  readonly props: Partial<PreviewTriggerProps>;
  readonly onClick: (event: React.MouseEvent<HTMLAnchorElement>) => void;
  /**
   * リンクの `aria-describedby` を組む。書き手 (remark) が付けた値を受け取り、チップが
   * このリンクを指している間だけ、その後ろにチップの id を足して返す。
   *
   * **元の値は消さない。** 脚注の参照は、脚注一覧の見出し (`footnote-label`) を既に
   * 指している。チップの id で置き換えると、開いている間だけその説明が失われる。
   * 閉じている間は受け取った値をそのまま返すので、サーバーの出力は変わらない。
   */
  readonly describedBy: (own: string | undefined) => string | undefined;
}

/** 持ち主が居ないときの引き金。リンクに何も足さない。 */
const IDLE_TRIGGER: PreviewTrigger = { props: {}, onClick: () => {}, describedBy: (own) => own };

/**
 * 本文のリンクを、プレビューの引き金にする。
 *
 * 持ち主が居なければ何も足さない (素のリンクのまま)。
 */
export function usePreviewTrigger(target: PreviewTarget | null): PreviewTrigger {
  const controller = useContext(PreviewContext);
  /*
   * 自分の要素は、触られたときに覚える。同じ記事へのリンクが本文に 2 本あっても、
   * 錨になるのは触られた 1 本だけにしたい (相手の種類と名前では見分けられない)。
   */
  const [element, setElement] = useState<Element | null>(null);

  if (controller === null || target === null) return IDLE_TRIGGER;

  const isAnchor = element !== null && controller.anchor === element;

  const intend = (own: Element): void => {
    if (!prefersHover()) return;
    setElement(own);
    controller.intend(target, own);
  };

  return {
    props: {
      onPointerEnter: (event) => {
        // 指で触れたときにも pointerenter は来る。ホバーではないので出さない。
        if (event.pointerType !== "touch") intend(event.currentTarget);
      },
      onPointerLeave: controller.relent,
      onFocus: (event) => {
        intend(event.currentTarget);
      },
      onBlur: controller.relent,
      ...(isAnchor && { "data-preview-anchor": "" }),
    },
    describedBy: (own) => {
      if (!isAnchor) return own;
      return own === undefined || own === "" ? controller.chipId : `${own} ${controller.chipId}`;
    },
    onClick: (event) => {
      // 押したら行き先へ移る。移った先にチップを残さない。
      controller.dismiss();
      if (target.kind !== "footnote" || !opensDrawerOn(event)) return;
      if (controller.openDrawer(target.id)) event.preventDefault();
    },
  };
}
