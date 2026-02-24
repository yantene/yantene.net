import type { RenderContext } from "./render-context";
import type { FootnoteDefinition, RootContent } from "mdast";

type BlockRenderer = (
  node: RootContent,
  index: number,
  ctx: RenderContext,
) => React.JSX.Element;

type FootnoteSectionProps = {
  readonly definitions: readonly FootnoteDefinition[];
  readonly ctx: RenderContext;
  readonly renderBlock: BlockRenderer;
};

export function FootnoteSection({
  definitions,
  ctx,
  renderBlock,
}: FootnoteSectionProps): React.JSX.Element {
  return (
    <section
      role="doc-endnotes"
      className="mt-12 text-sm text-muted-foreground"
    >
      <hr />
      <ol className="pl-6">
        {definitions.map((def) => {
          const number = ctx.footnoteMap.get(def.identifier);
          if (number == null) return null;
          return (
            <li
              key={def.identifier}
              id={`fn-${def.identifier}`}
              value={number}
              className="mb-2"
            >
              {def.children.map((child, j) => renderBlock(child, j, ctx))}
              <a
                href={`#fnref-${encodeURIComponent(def.identifier)}`}
                className="ml-1 no-underline text-primary"
                role="doc-backlink"
              >
                ↩
              </a>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
