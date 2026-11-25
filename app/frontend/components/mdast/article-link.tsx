import { usePreviewTrigger } from "~/frontend/components/preview/preview-context";

export interface ArticleLinkProps extends React.ComponentPropsWithoutRef<"a"> {
  /** 指している記事の slug。hast の段で href から取り出してある (preview-targets.ts)。 */
  readonly slug?: string;
}

/**
 * このサイトの記事へのリンク。
 *
 * **素の `<a>` のまま出す。** 本文の内部リンクは今までも素の `<a>` で (anchor.tsx)、
 * 遷移の仕方は変えない。足すのは出来事への反応だけで、ホバーできる環境でリンク先の
 * 題と要約をチップに出す (PreviewLayer)。
 *
 * タッチでは何も足さない。押せばそのまま遷移する。
 */
export function ArticleLink({
  slug,
  href,
  children,
  ...rest
}: Readonly<ArticleLinkProps>): React.JSX.Element {
  const trigger = usePreviewTrigger(slug === undefined ? null : { kind: "article", slug });

  return (
    <a
      href={href}
      {...rest}
      {...trigger.props}
      aria-describedby={trigger.describedBy(rest["aria-describedby"])}
      onClick={trigger.onClick}
    >
      {children}
    </a>
  );
}
