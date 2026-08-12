import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  HiHeart,
  HiOutlineFaceSmile,
  HiOutlineHeart,
  HiOutlinePlus,
} from "react-icons/hi2";
import { useFetcher } from "react-router";
import { EmojiPalette } from "./emoji-palette";
import { withPendingReaction } from "./reaction-state";
import type { ReactionState } from "./reaction-state";

/** 既定のリアクション。ハートを押すと「いいね」になる (サーバー側の like と同じ値)。 */
const LIKE = "❤️";

type ReactionBarProps = ReactionState;

/**
 * 送信中なら、その結果を先に見せる姿を返す。送信していなければそのまま。
 *
 * 押す意図は値の有無で決まる。空文字は取り消し。
 */
function pendingView(
  current: ReactionState,
  formData: FormData | undefined,
): ReactionState {
  const pending = formData?.get("emoji");
  if (pending === undefined || pending === null) return current;

  const emoji = typeof pending === "string" && pending !== "" ? pending : null;
  return withPendingReaction(current, emoji);
}

/**
 * 記事の末尾に置くリアクションの行。
 *
 * ハートで「いいね」、押されている絵文字は数と一緒に並べる。1 ノートにつき 1 人 1 つなので、
 * 別のものを押すと乗り換え、同じものをもう一度押すと取り消しになる。
 *
 * 押した本人かどうかはセッションで決まり、SSR の時点で確定している。ここでクライアント
 * 限定の判定を混ぜないこと (#156 と同じ hydration mismatch を作る)。
 *
 * `fetcher.Form` なので、JS が動かない環境でも素のフォーム送信としてそのまま働く。
 */
export function ReactionBar({
  reactions,
  mine,
}: ReactionBarProps): React.JSX.Element {
  const { t } = useTranslation();
  const fetcher = useFetcher();
  const [isPaletteOpen, setPaletteOpen] = useState(false);

  /*
   * 送信中は結果を先に見せる。確定値は action からの戻りで loader が引き直すので、
   * ここが作るのは往復の間だけの姿。
   */
  const view = pendingView({ reactions, mine }, fetcher.formData);

  const isLiked = view.mine === LIKE;

  return (
    <fetcher.Form
      method="post"
      className="reaction-bar"
      aria-label={t("reaction.reactionsLabel")}
    >
      {/*
        押すと「いまの 1 つ」を置き換える。すでにハートなら空を送って取り消す
        (値の有無だけで意図が決まるので、別の hidden を足さなくてよい)。
      */}
      <button
        type="submit"
        name="emoji"
        value={isLiked ? "" : LIKE}
        aria-pressed={isLiked}
        className={`reaction-like press-control${isLiked ? " is-active" : ""}`}
      >
        {isLiked ? <HiHeart aria-hidden /> : <HiOutlineHeart aria-hidden />}
        {t(isLiked ? "reaction.liked" : "reaction.like")}
      </button>

      {view.reactions.map((reaction) => {
        const isMine = view.mine === reaction.emoji;
        return (
          <button
            key={reaction.emoji}
            type="submit"
            name="emoji"
            value={isMine ? "" : reaction.emoji}
            aria-pressed={isMine}
            className={`reaction-chip press-control${isMine ? " is-active" : ""}`}
          >
            <span className="reaction-chip-emoji">{reaction.emoji}</span>
            <span className="reaction-chip-count">{reaction.count}</span>
          </button>
        );
      })}

      {/*
        パレットの入口。開閉と選択には JS が要るので、動かない環境では出さない
        (ハートと、すでに押されている絵文字は素のフォームとして押せるまま残る)。
      */}
      <details
        className="reaction-palette"
        open={isPaletteOpen}
        onToggle={(event) => {
          setPaletteOpen(event.currentTarget.open);
        }}
      >
        <summary
          className="reaction-palette-trigger press-control"
          aria-label={t("reaction.openPalette")}
        >
          <HiOutlineFaceSmile aria-hidden />
          <HiOutlinePlus aria-hidden className="reaction-palette-plus" />
        </summary>
        <div className="reaction-palette-panel">
          {/*
            選んだらその場で送る。フォームの submit を使わないのは、パレットの中に
            1902 個の submit ボタンを置かないため (押した 1 つだけを送れば足りる)。
          */}
          <EmojiPalette
            onPick={(emoji) => {
              setPaletteOpen(false);
              void fetcher.submit(
                { emoji: emoji === view.mine ? "" : emoji },
                { method: "post" },
              );
            }}
          />
        </div>
      </details>
    </fetcher.Form>
  );
}
