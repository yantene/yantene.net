import { useCallback, useEffect, useRef, useState } from "react";
import {
  advanceDayClock,
  randomizeDayClock,
  readDayClockPhase,
  readDayDurationMs,
} from "./day-clock";
import { Daywalker } from "./daywalker";
import {
  dayTickMinutes,
  dragDistanceToElapsed,
  formatClock,
  MINUTES_PER_DAY,
  phaseToMinutes,
} from "./time-axis";

/** 目盛りを並べる日数。流れ切ったときに画面の左右が空かない最小限より 1 日多く取る。 */
const DAYS_IN_TRACK = 3;

/** 矢印キー 1 回で動かす時間 (分)。 */
const ARROW_STEP_MINUTES = 15;

/** PageUp / PageDown 1 回で動かす時間 (分)。目盛りの間隔と揃えてある。 */
const PAGE_STEP_MINUTES = 180;

/** 位相 0 が指す時刻。SSR とハイドレーション直後はここから始まる。 */
const INITIAL_MINUTES = 12 * 60;

const TICKS = dayTickMinutes();

/**
 * ヒーロー下部の時刻の目盛りと、その上を歩く人。
 *
 * 目盛りを掴んで左右に引くと、空・太陽・月・雲がまとめて進退する。何日ぶんでも
 * 進められるので、月の満ち欠けが変わり、いずれ日食にも行き当たる。
 *
 * 操作しないあいだも目盛りは流れ続ける (CSS アニメーション)。JS が無い環境では
 * 掴めなくなるだけで、時計は止まらない。
 */
export function TimeScrubber(): React.JSX.Element {
  const [minutes, setMinutes] = useState(INITIAL_MINUTES);
  const dayRef = useRef<HTMLDivElement>(null);
  const walkerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const lastXRef = useRef(0);
  const dayWidthRef = useRef(0);
  const dayMsRef = useRef(0);

  /*
   * 読み上げ用の時刻を、いまの時計に合わせ直す。
   *
   * 呼ぶのは操作したときとフォーカスが入ったときだけ。放っておいても時計は進み続けるので
   * 値は少しずつ古くなるが、追随させるには毎秒この state を書き換えることになり、
   * フォーカス中ずっと値の変化を読み上げ続けてしまう。時計が自動で進むこと自体は装飾なので、
   * 静かさのほうを採る。操作した瞬間には必ず正しい値になる。
   */
  const syncTime = useCallback((): void => {
    setMinutes(phaseToMinutes(readDayClockPhase()));
  }, []);

  /*
   * 開いた時刻を毎回散らす。手を入れないと必ず南中の満月から始まってしまう。
   * SSR で決めると読み込みごとに描き分けが要るので、描画がついた後に一度だけ動かす。
   *
   * 読み上げ用の時刻を合わせるのは次のフレームに回す。ここで直に state を書くと、
   * 描画のたびに描画を呼ぶ形になってしまう。
   */
  useEffect(() => {
    randomizeDayClock();
    const frame = requestAnimationFrame(syncTime);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [syncTime]);

  const scrub = useCallback(
    (elapsedMs: number): void => {
      if (elapsedMs === 0) return;
      advanceDayClock(elapsedMs);
      syncTime();
    },
    [syncTime],
  );

  /*
   * 歩く向き。掴んで引いているあいだだけ反転させる。
   *
   * キー操作にも連動させると、押した瞬間に後ろ向きになったまま戻す機会がなくなる
   * (キーには「離して終わり」に当たる区切りがドラッグほど明確にない)。
   */
  const faceDirection = useCallback((isBackward: boolean): void => {
    walkerRef.current?.classList.toggle("daywalker-backward", isBackward);
  }, []);

  const handlePointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      /*
       * 換算に要る 2 つの値を掴んだ時点で測っておく。どちらも動いているあいだは
       * 変わらないうえ、1 日の長さを読むには全アニメーションを走査するので、
       * pointermove のたびに読み直すと指を動かしている間ずっと走査し続けることになる。
       */
      dayWidthRef.current = dayRef.current?.getBoundingClientRect().width ?? 0;
      dayMsRef.current = readDayDurationMs();
      if (dayWidthRef.current <= 0) return;

      draggingRef.current = true;
      lastXRef.current = event.clientX;
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [],
  );

  const handlePointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      if (!draggingRef.current) return;

      const distance = event.clientX - lastXRef.current;
      lastXRef.current = event.clientX;
      const elapsed = dragDistanceToElapsed(
        distance,
        dayWidthRef.current,
        dayMsRef.current,
      );
      if (elapsed !== 0) faceDirection(elapsed < 0);
      scrub(elapsed);
    },
    [faceDirection, scrub],
  );

  const endDrag = useCallback(
    (event: React.PointerEvent<HTMLDivElement>): void => {
      if (!draggingRef.current) return;
      draggingRef.current = false;
      event.currentTarget.releasePointerCapture(event.pointerId);
      faceDirection(false);
    },
    [faceDirection],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>): void => {
      const step = stepMinutesFor(event.key);
      if (step === 0) return;

      event.preventDefault();
      scrub((step / MINUTES_PER_DAY) * readDayDurationMs());
    },
    [scrub],
  );

  return (
    <>
      <Daywalker ref={walkerRef} />

      {/*
        値は 1 日内の時刻。日を跨ぐと 0:00 に戻るが、何日目かは月の満ち欠けが示すので
        値としては持たせていない。
      */}
      <div
        className="time-axis"
        role="slider"
        tabIndex={0}
        aria-label="時刻"
        aria-valuemin={0}
        aria-valuemax={MINUTES_PER_DAY - 1}
        aria-valuenow={Math.floor(minutes)}
        aria-valuetext={formatClock(minutes)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onKeyDown={handleKeyDown}
        onFocus={syncTime}
      >
        <div className="time-axis-track">
          {Array.from({ length: DAYS_IN_TRACK }, (_, day) => (
            <div
              className="time-axis-day"
              key={day}
              ref={day === 0 ? dayRef : undefined}
            >
              {TICKS.map((tick) => (
                <span className="time-axis-tick" key={tick}>
                  <span className="time-axis-tick-label">
                    {formatClock(tick)}
                  </span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

/** キーに対応する移動量 (分)。扱わないキーは 0。 */
function stepMinutesFor(key: string): number {
  if (key === "ArrowRight" || key === "ArrowUp") return ARROW_STEP_MINUTES;
  if (key === "ArrowLeft" || key === "ArrowDown") return -ARROW_STEP_MINUTES;
  if (key === "PageUp") return PAGE_STEP_MINUTES;
  if (key === "PageDown") return -PAGE_STEP_MINUTES;
  return 0;
}
