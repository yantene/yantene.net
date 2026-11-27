import { useTranslation } from "react-i18next";
import { SiMarkdown } from "react-icons/si";
import type { ReactionState } from "~/frontend/components/reaction/reaction-state";
import { ReactionBar } from "~/frontend/components/reaction/reaction-bar";
import { ShareBar } from "~/frontend/components/share/share-bar";

/** 置き場所。上下で余白と主張の強さを変えるだけで、中身は同じ。 */
export type ArticleActionsPlacement = "top" | "bottom";

export interface ArticleActionsProps extends ReactionState {
  /** 共有する絶対 URL。相対パスだと貼った先で開けない。 */
  readonly url: string;
  readonly title: string;
  readonly placement: ArticleActionsPlacement;
  /**
   * 原文 Markdown の行き先 (`/articles/<slug>.md`)。渡したときだけ帯の右端に出す。
   * 記事の頭に置く帯だけが渡す (読み終えた足元で原文を開く用は薄い)。
   */
  readonly markdownHref?: string;
}

/**
 * 記事に対して手を動かす場所 (リアクションと共有) をひとまとめにしたもの。
 *
 * 記事の上と下の両方に置く。長い記事だと、読み始めに「あとで共有しよう」と思っても
 * 末尾まで辿り着かないと押せないため。
 *
 * **上下は同じ状態を映す。** ReactionBar は同じキーの fetcher を使うので、片方で押した
 * 送信中の姿がもう片方にも出る。確定値は loader から降ってくるので、そちらも揃う。
 *
 * 読み上げでは同じものが 2 度並ぶことになるので、置き場所を名前に入れて区別する。
 */
export function ArticleActions({
  reactions,
  mine,
  url,
  title,
  placement,
  markdownHref,
}: ArticleActionsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <section
      className={`article-actions article-actions-${placement}`}
      aria-label={t(placement === "top" ? "articles.actionsTop" : "articles.actionsBottom")}
    >
      {/*
        促しを出すのは**下に置いたときだけ**。上にも出すと同じ促しが 1 記事に 2 度並ぶ。
        押したかどうかの判断は ReactionBar が持つ (送信中の姿と揃える必要があるため)。
      */}
      <ReactionBar
        reactions={reactions}
        mine={mine}
        shouldPromptReaction={placement === "bottom"}
      />
      <ShareBar url={url} title={title} />
      {markdownHref !== undefined && (
        /*
          原文 Markdown は React Router のルートではなく Hono が返すので、Link ではなく
          素の <a> にする (クライアント遷移させない)。見える字は「Markdown」だけなので、
          読み上げには何が起きるかまで言う (見える字を含む名前にする。WCAG 2.5.3)。
        */
        <a
          href={markdownHref}
          className="article-actions-markdown press-control"
          aria-label={t("articles.viewMarkdown")}
        >
          <SiMarkdown className="brand-mark" aria-hidden />
          Markdown
        </a>
      )}
    </section>
  );
}
