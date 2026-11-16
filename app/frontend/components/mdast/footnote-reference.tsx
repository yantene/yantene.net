import { Link } from "react-router";
import { usePreviewTrigger } from "~/frontend/components/preview/preview-context";

/**
 * 脚注の参照 (`<sup>` の中の番号)。
 *
 * **何も起きていない間は、今までと同じリンクを出す。** サーバーが描く HTML は
 * `<a href="#user-content-fn-1">` のままで、JavaScript が動かなくても脚注へ飛べる。
 * Link に通すのも今までどおり (素の `<a href="#...">` は ScrollRestoration がハッシュ
 * ジャンプを打ち消す。anchor.tsx を参照)。
 *
 * 足すのは出来事への反応だけ。ホバーできる環境ではチップを、そうでなければ押したときに
 * ドロワーを出す (PreviewLayer)。
 */
export function FootnoteReference({
  href,
  children,
  ...rest
}: Readonly<React.ComponentPropsWithoutRef<"a">>): React.JSX.Element {
  // 行き先の id が、そのまま脚注の名前になる (`#user-content-fn-1` → `user-content-fn-1`)。
  const id = href?.startsWith("#") === true ? href.slice(1) : undefined;
  const trigger = usePreviewTrigger(id === undefined ? null : { kind: "footnote", id });

  return (
    <Link to={href ?? ""} {...rest} {...trigger.props} onClick={trigger.onClick}>
      {children}
    </Link>
  );
}
