/** 題を持たない埋め込みに与える名前。hast の段 (toEmbed) と描画の両方が使う。 */
export const DEFAULT_EMBED_TITLE = "埋め込み動画";

/** 埋め込み (iframe) 差し替え: 幅に追随する枠に収める。 */
export function EmbedFrame(
  props: Readonly<React.ComponentPropsWithoutRef<"iframe">>,
): React.JSX.Element {
  return (
    <div className="note-embed">
      <iframe {...props} title={props.title ?? DEFAULT_EMBED_TITLE} />
    </div>
  );
}
