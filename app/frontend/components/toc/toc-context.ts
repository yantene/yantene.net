import { createContext } from "react";
import type { TocHeading } from "~/backend/handlers/articles/toc-headings";

/** 本文に目次を差し込む位置を表す、Markdown 記法には無い要素名。 */
export const TOC_TAG = "inline-toc";

/*
 * 目次の中身を描画側へ渡す道。
 *
 * 差し込む印は hast の要素なので、運べるのは属性に書ける値だけになる。見出しの列を
 * 属性に詰めることもできなくはないが、文脈に載せるほうが素直で、リンクカードが
 * 同じことを先にやっている (link-card-context.ts)。
 *
 * 描画するコンポーネントと別のファイルに置いてあるのも同じ理由で、1 つのファイルが
 * コンポーネント以外も export すると HMR が効かなくなるため。
 */
export const TocHeadingsContext = createContext<readonly TocHeading[]>([]);
