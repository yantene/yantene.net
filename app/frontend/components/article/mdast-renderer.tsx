import { createElement } from "react";
import { getHeadingId } from "./heading-utils";
import type { PhrasingContent, Root, RootContent } from "mdast";

type MdastRendererProps = {
  readonly content: Root;
};

const headingTag = (depth: number): "h1" | "h2" | "h3" | "h4" | "h5" | "h6" =>
  `h${String(Math.min(Math.max(depth, 1), 6))}` as
    | "h1"
    | "h2"
    | "h3"
    | "h4"
    | "h5"
    | "h6";

function renderPhrasingContent(
  node: PhrasingContent,
  index: number,
): React.JSX.Element {
  switch (node.type) {
    case "text": {
      return <>{node.value}</>;
    }
    case "emphasis": {
      return (
        <em key={index}>
          {node.children.map((child, i) => renderPhrasingContent(child, i))}
        </em>
      );
    }
    case "strong": {
      return (
        <strong key={index}>
          {node.children.map((child, i) => renderPhrasingContent(child, i))}
        </strong>
      );
    }
    case "inlineCode": {
      return <code key={index}>{node.value}</code>;
    }
    case "link": {
      const isExternal = node.url.startsWith("http");
      return (
        <a
          key={index}
          href={node.url}
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
        >
          {node.children.map((child, i) => renderPhrasingContent(child, i))}
        </a>
      );
    }
    case "image": {
      return <img key={index} src={node.url} alt={node.alt ?? ""} />;
    }
    case "break": {
      return <br key={index} />;
    }
    default: {
      return <span key={index} />;
    }
  }
}

function renderBlockContent(
  node: RootContent,
  index: number,
): React.JSX.Element {
  switch (node.type) {
    case "heading": {
      const id = getHeadingId(node);
      const children = node.children.map((child, i) =>
        renderPhrasingContent(child, i),
      );
      return createElement(
        headingTag(node.depth),
        { key: index, id },
        <a href={`#${id}`} className="article-heading-anchor">
          {children}
        </a>,
      );
    }
    case "paragraph": {
      return (
        <p key={index}>
          {node.children.map((child, i) => renderPhrasingContent(child, i))}
        </p>
      );
    }
    case "blockquote": {
      return (
        <blockquote key={index}>
          {node.children.map((child, i) => renderBlockContent(child, i))}
        </blockquote>
      );
    }
    case "list": {
      const items = node.children.map((item, i) => (
        <li key={i}>
          {item.children.map((child, j) => renderBlockContent(child, j))}
        </li>
      ));
      return node.ordered === true ? (
        <ol key={index}>{items}</ol>
      ) : (
        <ul key={index}>{items}</ul>
      );
    }
    case "code": {
      return (
        <pre key={index}>
          <code
            className={
              node.lang !== null && node.lang !== undefined
                ? `language-${node.lang}`
                : undefined
            }
          >
            {node.value}
          </code>
        </pre>
      );
    }
    case "thematicBreak": {
      return <hr key={index} />;
    }
    default: {
      return <div key={index} />;
    }
  }
}

const isH1 = (node: RootContent): boolean =>
  node.type === "heading" && node.depth === 1;

export function MdastRenderer({
  content,
}: MdastRendererProps): React.JSX.Element {
  return (
    <div className="article-content">
      {content.children
        .filter((node) => !isH1(node))
        .map((node, i) => renderBlockContent(node, i))}
    </div>
  );
}
