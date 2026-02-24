export type { HeadingNumberMap } from "./heading-utils";
import type { HeadingNodeIdMap, HeadingNumberMap } from "./heading-utils";
import type { FootnoteDefinition } from "mdast";

export type FootnoteMap = ReadonlyMap<string, number>;

export type RenderContext = {
  readonly footnoteMap: FootnoteMap;
  readonly headingNumberMap: HeadingNumberMap;
  readonly headingNodeIdMap: HeadingNodeIdMap;
};

export function buildFootnoteMap(
  definitions: readonly FootnoteDefinition[],
): FootnoteMap {
  return new Map(definitions.map((def, i) => [def.identifier, i + 1]));
}
