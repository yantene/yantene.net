import { useEffect, useState } from "react";

/**
 * 帯を出すまでの待ち。これより速く終わる遷移では出さない。
 *
 * 近いページや温まった loader は数十 ms で返るので、その度に光が走ると画面がちらついて
 * 落ち着かない。待たされていると感じ始めるあたりまでは黙っている。
 */
const APPEAR_DELAY_MS = 150;

interface NavigationProgressProps {
  /** 遷移中か (React Router の navigation.state が idle でないか)。 */
  readonly isPending: boolean;
  /** 読み上げに出す文言。i18n の解決は呼び出し側が持つ。 */
  readonly label: string;
}

/**
 * 遷移中であることを示す、画面上端の帯。
 *
 * 見た目と間の取り方だけを持ち、遷移の状態は受け取る。useNavigation をここで直に読むと、
 * データルーターの外 (Storybook など) では描けなくなるため。
 */
export function NavigationProgress({
  isPending,
  label,
}: NavigationProgressProps): React.JSX.Element {
  const [hasWaited, setHasWaited] = useState(false);

  /*
   * 遷移の切り替わりで待ちを数え直す。これが無いと、一度出したあとの遷移が待ちなしで
   * 出てちらつく。描画中に state を書き換えるのは、この場で作り直すための React の作法。
   */
  const [isShownPending, setShownPending] = useState(isPending);
  if (isShownPending !== isPending) {
    setShownPending(isPending);
    setHasWaited(false);
  }

  /*
   * SSR では effect が走らないので必ず待ち前から始まる。ハイドレーション直後の描画も
   * 同じ値から始まるため、サーバーとクライアントで最初の HTML が食い違わない。
   */
  useEffect(() => {
    if (!isPending) return;

    const timer = globalThis.setTimeout(() => {
      setHasWaited(true);
    }, APPEAR_DELAY_MS);
    return () => {
      globalThis.clearTimeout(timer);
    };
  }, [isPending]);

  /*
   * 入れ物は遷移していなくても置いたままにする。role="status" は中身が変わったときに
   * 読まれるので、入れ物ごと現れる作りだと読み上げが落ちる読み手がいる。
   *
   * 読ませるのは短い文言 1 回きりに留める。遷移のたびに進み具合まで喋ると、
   * 読み飛ばせない量になって邪魔になる。
   */
  return (
    <div className="navigation-progress" role="status">
      {isPending && hasWaited && (
        <>
          <span className="navigation-progress-bar" aria-hidden="true" />
          <span className="sr-only">{label}</span>
        </>
      )}
    </div>
  );
}
