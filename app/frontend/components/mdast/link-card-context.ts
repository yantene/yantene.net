import { createContext } from "react";
import type { LinkCardView } from "~/backend/handlers/link-cards/link-card-view";

/** カードに差し替える段落を表す、Markdown 記法には無い要素名。 */
export const LINK_CARD_TAG = "link-card";

/*
 * カードの中身を描画側へ渡す道。
 *
 * hast を通せるのは URL 1 つだけなので、中身は文脈に載せる。toJsxRuntime に渡す
 * components は要素の属性しか受け取らず、外側の値を閉じ込められないため。
 *
 * 描画するコンポーネント (link-card-slot.tsx) と別のファイルに置いてあるのは、
 * 1 つのファイルがコンポーネント以外も export すると HMR が効かなくなるため。
 */
export const LinkCardsContext = createContext<
  ReadonlyMap<string, LinkCardView>
>(new Map());
