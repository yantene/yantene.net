import type { FootnoteDefinition } from "mdast";

export type FootnoteMap = ReadonlyMap<string, number>;
export type HeadingNumberMap = ReadonlyMap<string, string>;

export type RenderContext = {
  readonly footnoteMap: FootnoteMap;
  readonly headingNumberMap: HeadingNumberMap;
};

export function buildFootnoteMap(
  definitions: readonly FootnoteDefinition[],
): FootnoteMap {
  return new Map(definitions.map((def, i) => [def.identifier, i + 1]));
}
