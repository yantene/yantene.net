import { useTranslation } from "react-i18next";
import type { ReactionState } from "~/frontend/components/reaction/reaction-state";
import { ReactionBar } from "~/frontend/components/reaction/reaction-bar";
import { ShareMenu } from "~/frontend/components/share/share-menu";

/** 置き場所。上下で余白と主張の強さを変えるだけで、中身は同じ。 */
export type NoteActionsPlacement = "top" | "bottom";

export interface NoteActionsProps extends ReactionState {
  /** 共有する絶対 URL。相対パスだと貼った先で開けない。 */
  readonly url: string;
  readonly title: string;
  readonly placement: NoteActionsPlacement;
}

/**
 * 記事に対して手を動かす場所 (リアクションと共有) をひとまとめにしたもの。
 *
 * 記事の上と下の両方に置く。長い記事だと、読み始めに「あとで共有しよう」と思っても
 * 末尾まで辿り着かないと押せないため。
 *
 * **上下は同じ状態を映す。** ReactionBar は同じ鍵の fetcher を使うので、片方で押した
 * 送信中の姿がもう片方にも出る。確定値は loader から降ってくるので、そちらも揃う。
 *
 * 読み上げでは同じものが 2 度並ぶことになるので、置き場所を名前に入れて区別する。
 */
export function NoteActions({
  reactions,
  mine,
  url,
  title,
  placement,
}: NoteActionsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <section
      className={`note-actions note-actions-${placement}`}
      aria-label={t(
        placement === "top" ? "notes.actionsTop" : "notes.actionsBottom",
      )}
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
      <ShareMenu url={url} title={title} />
    </section>
  );
}
