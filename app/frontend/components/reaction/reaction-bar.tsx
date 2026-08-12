import { useCallback, useId, useRef, useState } from "react";
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
import { useDismiss } from "./use-dismiss";
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
  const paletteRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  /*
   * 外側の押下と Esc で閉じる。
   *
   * Esc のときだけ焦点を入口に戻す。キーボードで閉じた人の焦点が行き場を失うため。
   * 外側を押して閉じたときは、押した先に焦点が移るのが自然なので触らない。
   */
  const closePalette = useCallback((reason: "escape" | "outside") => {
    setPaletteOpen(false);
    if (reason === "escape") triggerRef.current?.focus();
  }, []);

  useDismiss({
    isOpen: isPaletteOpen,
    containerRef: paletteRef,
    onDismiss: closePalette,
  });

  /*
   * 送信中は結果を先に見せる。確定値は action からの戻りで loader が引き直すので、
   * ここが作るのは往復の間だけの姿。
   */
  const view = pendingView({ reactions, mine }, fetcher.formData);

  const isLiked = view.mine === LIKE;
  // 同じページに 2 つ置かれても id がぶつからないようにする。
  const hintId = useId();

  return (
    <fetcher.Form
      method="post"
      className="reaction-bar"
      aria-label={t("reaction.reactionsLabel")}
      /*
       * 押した位置に留まる。action は記事へ送り返すので、そのままだと読み終えた足元で
       * 押したのに記事の先頭へ飛ばされる。
       */
      preventScrollReset
    >
      {/*
        ハートと押されている絵文字は「この中から 1 つ」を選ぶもの。別々に押せるように
        見えると、パレットで選んだときにハートが黙って消えたように映るので、1 つの
        まとまりとして囲い、その旨を読み上げにも出す。

        role="radiogroup" は使わない。矢印キーでの移動と roving tabindex が要るが、
        それらは JS 前提になり、JS 無しでも押せるという性質を壊す。囲いと説明で示す。
      */}
      <div
        className="reaction-choices"
        role="group"
        aria-label={t("reaction.reactionsLabel")}
        aria-describedby={hintId}
        data-chosen={view.mine === null ? "false" : "true"}
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
      </div>

      {/* 排他であることの説明。囲いから aria-describedby で指す。 */}
      <p id={hintId} className="sr-only">
        {t("reaction.onlyOne")}
      </p>

      {/*
        パレットの入口。開閉と選択には JS が要るので、動かない環境では出さない
        (ハートと、すでに押されている絵文字は素のフォームとして押せるまま残る)。

        details ではなく button で開閉する。details は state と DOM のトグルが二重になり、
        閉じたつもりが開いたままになる。ここは JS 前提なので、状態を 1 つに絞ってよい。
      */}
      <div className="reaction-palette" ref={paletteRef}>
        <button
          ref={triggerRef}
          type="button"
          aria-label={t("reaction.openPalette")}
          aria-expanded={isPaletteOpen}
          className="reaction-palette-trigger press-control"
          onClick={() => {
            setPaletteOpen(!isPaletteOpen);
          }}
        >
          <HiOutlineFaceSmile aria-hidden />
          <HiOutlinePlus aria-hidden className="reaction-palette-plus" />
        </button>

        {/*
          開いたときだけ描く。パレットのデータ (数百 KB) を読むのはこの中なので、
          畳んだまま置くと記事を開いただけで通信が起きる。
        */}
        {isPaletteOpen && (
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
                  { method: "post", preventScrollReset: true },
                );
              }}
            />
          </div>
        )}
      </div>
    </fetcher.Form>
  );
}
