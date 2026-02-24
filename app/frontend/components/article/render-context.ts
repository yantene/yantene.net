export type FootnoteMap = ReadonlyMap<string, number>;
export type HeadingNumberMap = ReadonlyMap<string, string>;

export type RenderContext = {
  readonly footnoteMap: FootnoteMap;
  readonly headingNumberMap: HeadingNumberMap;
};
