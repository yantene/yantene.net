import { useCallback, useId, useRef, useState } from "react";
import { emojiSvgPath } from "~/lib/emoji-svg";
import { useTranslation } from "react-i18next";
import { HiOutlineFaceSmile, HiOutlinePlus } from "react-icons/hi2";
import { useFetcher } from "react-router";
import { EmojiPalette } from "./emoji-palette";
import { ReactionHint } from "./reaction-hint";
import { withPendingReaction } from "./reaction-state";
import { useDismiss } from "./use-dismiss";
import type { ReactionCount, ReactionState } from "./reaction-state";

/** 既定のリアクション。ハートを押すと「いいね」になる (サーバー側の like と同じ値)。 */
const LIKE = "❤️";

/** 同じ記事のリアクションはどこに置かれても 1 つの送信として扱う。 */
const REACTION_FETCHER_KEY = "note-reaction";

interface ReactionBarProps extends ReactionState {
  /**
   * まだ押していない人に促しを出すか。
   *
   * 出す・出さないの判断のうち「置き場所」は呼び出し側が持ち、「押したかどうか」は
   * ここで見る。**送信中の姿 (楽観表示) と同じ値で判定する**ので、押した瞬間に
   * チップと促しが食い違わない。
   */
  readonly shouldPromptReaction?: boolean;
}

/**
 * 画面に出す並び。**ハートは押されていなくても必ず先頭に出す。**
 *
 * 何も押されていない記事に手がかりが 1 つも無いと、押せること自体が伝わらない。
 * 既定のリアクションだけは 0 件でも席を用意しておく。
 *
 * 位置を固定するのは、数で並び替えると押した瞬間にハートが動いて見失うため。
 */
function toChips(reactions: readonly ReactionCount[]): readonly ReactionCount[] {
  const like = reactions.find((reaction) => reaction.emoji === LIKE);
  const others = reactions.filter((reaction) => reaction.emoji !== LIKE);
  return [like ?? { emoji: LIKE, count: 0 }, ...others];
}

/**
 * 送信中なら、その結果を先に見せる姿を返す。送信していなければそのまま。
 *
 * 押す意図は値の有無で決まる。空文字は取り消し。
 */
function pendingView(current: ReactionState, formData: FormData | undefined): ReactionState {
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
  shouldPromptReaction = false,
}: ReactionBarProps): React.JSX.Element {
  const { t } = useTranslation();
  /*
   * 上下に 2 つ置かれるので、同じ鍵で fetcher を共有する。別々にすると、送信中の
   * 楽観表示が押したほうにしか出ず、もう片方だけ古い姿のまま残る。
   */
  const fetcher = useFetcher({ key: REACTION_FETCHER_KEY });
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

  /*
   * 送信が終わるまで、次の押下を受け取らない (#248)。
   *
   * 同じ押下が 2 度サーバーへ届くと、両方が「まだ押していない」を読んで数を 2 つ進める。
   * セッションが持つリアクションは 1 件なので、取り消しても 1 しか戻らず、差が残り続ける。
   *
   * 待つのは応答までではなく idle までにする。`loading` の間は loader がまだ引き直して
   * いないので、そこで次を送ると古い `mine` を元に「押す/取り消す」を決めることになる。
   * 楽観表示は `fetcher.formData` が残っている間ずっと出るので、待たせても画面は止まらない。
   *
   * これで止まるのは読み手のダブルクリックだけ。意図的な二重送信も、JS が無い環境での
   * 二重 submit も素通しのままになる。そこまで塞ぐなら、セッションの置き場所ごと
   * 変えることになる。
   */
  const isSending = fetcher.state !== "idle";

  // 同じページに 2 つ置かれても id がぶつからないようにする。
  const hintId = useId();

  return (
    <fetcher.Form
      method="post"
      className="reaction-bar"
      aria-label={t("reaction.reactionsLabel")}
      aria-describedby={hintId}
      /*
       * 送信中の押下はここで捨てる。react-router の Form は、渡した onSubmit を先に
       * 呼んでから `defaultPrevented` を見るので、これで送信そのものが止まる。
       */
      onSubmit={(event) => {
        if (isSending) event.preventDefault();
      }}
      /*
       * 押した位置に留まる。action は記事へ送り返すので、そのままだと読み終えた足元で
       * 押したのに記事の先頭へ飛ばされる。
       */
      preventScrollReset
    >
      {/*
        押されている絵文字の並び。ハートも同じ形の 1 つとして混ぜる。

        ハートだけ別の姿にすると、独立したトグルに見えて「同じ 1 枠を奪い合う」ことが
        伝わらない (ADR 0012)。同じ形で並べれば、常にどれか 1 つだけが光る。
        押すと「いまの 1 つ」を置き換える。すでに押しているものなら空を送って取り消す
        (値の有無だけで意図が決まるので、別の hidden を足さなくてよい)。
      */}
      {toChips(view.reactions).map((reaction) => {
        const isMine = view.mine === reaction.emoji;
        return (
          <button
            key={reaction.emoji}
            type="submit"
            name="emoji"
            value={isMine ? "" : reaction.emoji}
            aria-pressed={isMine}
            /*
             * `disabled` は使わない。押した瞬間に焦点の当たっている要素が disabled に
             * なると、焦点が body へ落ちて読み上げの現在地が失われる。押せる形のまま
             * 残し、受け付けないことだけを伝える。
             */
            aria-disabled={isSending}
            aria-label={reaction.emoji === LIKE ? t("reaction.like") : undefined}
            className={`reaction-chip press-control${isMine ? " is-active" : ""}`}
          >
            {/*
              絵はフォントではなく SVG で出す。チップは常設なので、フォントで組むと
              617KB の woff2 を全記事ページで読むことになる (#200)。

              alt に絵文字そのものを置くのが受け皿。@twemoji/svg は Unicode 15 までで、
              新しい絵文字には SVG が無いが、取れなければ alt の字がそのまま出る。
            */}
            <img
              className="reaction-chip-emoji"
              src={emojiSvgPath(reaction.emoji)}
              alt={reaction.emoji}
              width={18}
              height={18}
              decoding="async"
            />
            <span className="reaction-chip-count">{reaction.count}</span>
          </button>
        );
      })}

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
                // フォームの submit を通らない経路なので、門番をここにも置く。
                if (isSending) return;
                void fetcher.submit(
                  { emoji: emoji === view.mine ? "" : emoji },
                  { method: "post", preventScrollReset: true },
                );
              }}
            />
          </div>
        )}
      </div>
      {/*
        排他であることの説明。行そのものから aria-describedby で指す。

        並びを見れば「常に 1 つだけ光る」ことは分かるが、読み上げでは押せるものが
        いくつも並んでいるようにしか聞こえない。言葉でも 1 度だけ添える。
      */}
      <p id={hintId} className="sr-only">
        {t("reaction.onlyOne")}
      </p>

      {/*
        まだ押していない人への促し。送信中は view.mine が先に埋まるので、押した瞬間に
        引っ込む (確定を待たない)。取り消したときは、また出る。
      */}
      {shouldPromptReaction && view.mine === null && <ReactionHint />}
    </fetcher.Form>
  );
}
