import { toJsxRuntime } from "hast-util-to-jsx-runtime";
import { toHast } from "mdast-util-to-hast";
import { useMemo } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import { unified } from "unified";
import "./mdast-renderer.css";
import type { Element, Root as HastRoot, RootContent } from "hast";
import type { Root as MdastRoot } from "mdast";

// hast (HTML AST) 段でのプラグイン。runSync で同期実行できるため SSR でもそのまま使える。
// - rehypeSlug: 見出しに id を付与し目次リンクを可能にする
// - rehypeHighlight: フェンス付きコードにトークンクラスを付与する
//   (未知の言語指定はハイライトせず素通しするだけで throw しない)
const hastProcessor = unified().use(rehypeSlug).use(rehypeHighlight);

const isExternalHref = (href: string): boolean =>
  href.startsWith("http://") || href.startsWith("https://");

/** img 要素: 相対 URL を解決し、遅延読み込み・非同期デコードを既定にする。 */
function transformImage(
  element: Element,
  resolve: ((src: string) => string) | undefined,
): void {
  const src = element.properties.src;
  if (typeof src === "string" && resolve !== undefined) {
    element.properties.src = resolve(src);
  }
  element.properties.loading = "lazy";
  element.properties.decoding = "async";
  element.properties.alt ??= "";
}

/** a 要素: 外部リンクは別タブで開き、noreferrer 等を付けて安全にする。 */
function transformAnchor(element: Element): void {
  const href = element.properties.href;
  if (typeof href === "string" && isExternalHref(href)) {
    element.properties.target = "_blank";
    element.properties.rel = ["noopener", "noreferrer", "nofollow"];
  }
}

/**
 * hast ツリーを再帰的に走査し、img / a 要素へ変換を適用する。toHast が毎回新しい
 * ツリーを生成するため、ここでの破壊的変更は入力の MDAST には影響しない。
 */
function applyElementTransforms(
  node: HastRoot | RootContent,
  resolveImageUrl: ((src: string) => string) | undefined,
): void {
  if (node.type === "element") {
    if (node.tagName === "img") transformImage(node, resolveImageUrl);
    else if (node.tagName === "a") transformAnchor(node);
  }
  if ("children" in node) {
    for (const child of node.children) {
      applyElementTransforms(child, resolveImageUrl);
    }
  }
}

export interface MdastRendererProps {
  /** レンダリング対象の MDAST (Markdown AST) ルート。 */
  readonly node: MdastRoot;
  /**
   * 画像 URL を解決する関数。相対パスをアセット API URL に変換したい場合に注入する。
   * 省略時は素通し (URL は既に解決済みという前提)。
   */
  readonly transformImageUrl?: (src: string) => string;
  /** ルート要素に付与する追加クラス。 */
  readonly className?: string;
}

/**
 * MDAST を React 要素に変換して描画する (MDAST → HAST → React)。
 * サーバー側では本文を HTML 化せず MDAST のまま渡し、ここでレンダリングする (ADR 0006)。
 */
export function MdastRenderer({
  node,
  transformImageUrl,
  className,
}: MdastRendererProps): React.JSX.Element {
  const content = useMemo(() => {
    const hast = toHast(node, { allowDangerousHtml: false }) as HastRoot;
    // unified() を無型で始めているため runSync の戻りは Node 扱い。実体は hast Root。
    const transformed = hastProcessor.runSync(hast) as HastRoot;
    applyElementTransforms(transformed, transformImageUrl);

    return toJsxRuntime(transformed, {
      Fragment,
      jsx,
      jsxs,
    }) as React.JSX.Element;
  }, [node, transformImageUrl]);

  return (
    <article
      className={`note-prose prose max-w-none ${className ?? ""}`.trim()}
    >
      {content}
    </article>
  );
}
