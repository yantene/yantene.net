import { Fragment, createElement } from "react";
import type { Element, ElementContent, Root } from "hast";

function renderHastNode(
  node: ElementContent,
  index: number,
): React.JSX.Element {
  switch (node.type) {
    case "text": {
      return createElement(Fragment, { key: index }, node.value);
    }
    case "element": {
      return renderHastElement(node, index);
    }
    default: {
      return <span key={index} />;
    }
  }
}

function renderHastElement(element: Element, index: number): React.JSX.Element {
  const children = element.children.map((child: ElementContent, i: number) =>
    renderHastNode(child, i),
  );

  const style = element.properties["style"];
  const className = element.properties["className"];

  const props: Record<string, unknown> = { key: index };
  if (typeof style === "string") {
    props["style"] = parseInlineStyle(style);
  }
  if (Array.isArray(className)) {
    props["className"] = className.join(" ");
  } else if (typeof className === "string") {
    props["className"] = className;
  }

  switch (element.tagName) {
    case "span": {
      return <span {...props}>{children}</span>;
    }
    case "pre": {
      return <pre {...props}>{children}</pre>;
    }
    case "code": {
      return <code {...props}>{children}</code>;
    }
    case "div": {
      return <div {...props}>{children}</div>;
    }
    default: {
      return <span {...props}>{children}</span>;
    }
  }
}

function parseInlineStyle(style: string): React.CSSProperties {
  const result: Record<string, string> = {};
  for (const declaration of style.split(";")) {
    const colonIndex = declaration.indexOf(":");
    if (colonIndex === -1) continue;
    const prop = declaration.slice(0, colonIndex).trim();
    const value = declaration.slice(colonIndex + 1).trim();
    if (prop && value) {
      result[camelCase(prop)] = value;
    }
  }
  return result;
}

function camelCase(str: string): string {
  return str.replaceAll(/-([a-z])/g, (_, c: string) => c.toUpperCase());
}

export function HastRenderer({
  hast,
}: {
  readonly hast: Root;
}): React.JSX.Element {
  return (
    <>
      {hast.children.map((child, i) =>
        renderHastNode(child as ElementContent, i),
      )}
    </>
  );
}
