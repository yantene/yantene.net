import { Fragment, createElement } from "react";
import { FootnoteSection } from "./footnote-section";
import { HastRenderer } from "./hast-renderer";
import {
  buildHeadingNodeIdMap,
  buildHeadingNumberMap,
} from "./heading-utils";
import { buildFootnoteMap, type RenderContext } from "./render-context";
import type { Root as HastRoot } from "hast";
import type {
  FootnoteDefinition,
  PhrasingContent,
  Root,
  RootContent,
} from "mdast";

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
  ctx: RenderContext,
): React.JSX.Element {
  switch (node.type) {
    case "text": {
      return createElement(Fragment, { key: index }, node.value);
    }
    case "emphasis": {
      return (
        <em key={index}>
          {node.children.map((child, i) =>
            renderPhrasingContent(child, i, ctx),
          )}
        </em>
      );
    }
    case "strong": {
      return (
        <strong key={index}>
          {node.children.map((child, i) =>
            renderPhrasingContent(child, i, ctx),
          )}
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
          {node.children.map((child, i) =>
            renderPhrasingContent(child, i, ctx),
          )}
        </a>
      );
    }
    case "image": {
      return <img key={index} src={node.url} alt={node.alt ?? ""} />;
    }
    case "break": {
      return <br key={index} />;
    }
    case "delete": {
      return (
        <del key={index}>
          {node.children.map((child, i) =>
            renderPhrasingContent(child, i, ctx),
          )}
        </del>
      );
    }
    case "footnoteReference": {
      const footnoteNumber = ctx.footnoteMap.get(node.identifier);
      if (footnoteNumber == null) return <sup key={index}>[?]</sup>;
      return (
        <sup key={index}>
          <a
            href={`#fn-${node.identifier}`}
            id={`fnref-${node.identifier}`}
            className="text-primary no-underline text-[0.75em]"
            role="doc-noteref"
          >
            [{footnoteNumber}]
          </a>
        </sup>
      );
    }
    default: {
      return <span key={index} />;
    }
  }
}

function renderBlockContent(
  node: RootContent,
  index: number,
  ctx: RenderContext,
): React.JSX.Element {
  switch (node.type) {
    case "heading": {
      const id =
        ctx.headingNodeIdMap.get(node) ?? `heading-${String(index)}`;
      const number = ctx.headingNumberMap.get(id);
      const children = node.children.map((child, i) =>
        renderPhrasingContent(child, i, ctx),
      );
      return createElement(
        headingTag(node.depth),
        { key: index, id },
        <a
          href={`#${id}`}
          className="text-inherit no-underline hover:underline hover:underline-offset-4 hover:decoration-muted-foreground"
        >
          {number !== undefined && (
            <span className="text-muted-foreground">{number} </span>
          )}
          {children}
        </a>,
      );
    }
    case "paragraph": {
      return (
        <p key={index}>
          {node.children.map((child, i) =>
            renderPhrasingContent(child, i, ctx),
          )}
        </p>
      );
    }
    case "blockquote": {
      return (
        <blockquote key={index}>
          {node.children.map((child, i) => renderBlockContent(child, i, ctx))}
        </blockquote>
      );
    }
    case "list": {
      const items = node.children.map((item, i) => (
        <li key={i}>
          {item.children.map((child, j) => renderBlockContent(child, j, ctx))}
        </li>
      ));
      return node.ordered === true ? (
        <ol key={index}>{items}</ol>
      ) : (
        <ul key={index}>{items}</ul>
      );
    }
    case "code": {
      const hastData = (node.data as Record<string, unknown> | undefined)
        ?.hast as HastRoot | undefined;
      if (hastData) {
        return (
          <div key={index} className="article-code-block mb-6">
            <HastRenderer hast={hastData} />
          </div>
        );
      }
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
    case "table": {
      const [headerRow, ...bodyRows] = node.children;
      const alignments = node.align ?? [];

      const alignStyle = (
        colIndex: number,
      ): React.CSSProperties | undefined => {
        // eslint-disable-next-line security/detect-object-injection
        const align = alignments[colIndex];
        if (!align) return undefined;
        return { textAlign: align };
      };

      return (
        <div key={index} className="mb-6 overflow-x-auto">
          <table>
            <thead>
              <tr>
                {headerRow.children.map((cell, ci) => (
                  <th key={ci} style={alignStyle(ci)}>
                    {cell.children.map((child, pi) =>
                      renderPhrasingContent(child, pi, ctx),
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            {bodyRows.length > 0 && (
              <tbody>
                {bodyRows.map((row, ri) => (
                  <tr key={ri}>
                    {row.children.map((cell, ci) => (
                      <td key={ci} style={alignStyle(ci)}>
                        {cell.children.map((child, pi) =>
                          renderPhrasingContent(child, pi, ctx),
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            )}
          </table>
        </div>
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

const isFootnoteDefinition = (node: RootContent): node is FootnoteDefinition =>
  node.type === "footnoteDefinition";

const isMainContent = (node: RootContent): boolean =>
  !isH1(node) && !isFootnoteDefinition(node);

export function MdastRenderer({
  content,
}: MdastRendererProps): React.JSX.Element {
  const definitions = content.children.filter((node) =>
    isFootnoteDefinition(node),
  );
  const footnoteMap = buildFootnoteMap(definitions);
  const headingNumberMap = buildHeadingNumberMap(content);
  const headingNodeIdMap = buildHeadingNodeIdMap(content);
  const ctx: RenderContext = { footnoteMap, headingNumberMap, headingNodeIdMap };
  const mainNodes = content.children.filter((node) => isMainContent(node));

  return (
    <div className="article-content">
      {mainNodes.map((node, i) => renderBlockContent(node, i, ctx))}
      {definitions.length > 0 && (
        <FootnoteSection
          definitions={definitions}
          ctx={ctx}
          renderBlock={renderBlockContent}
        />
      )}
    </div>
  );
}
