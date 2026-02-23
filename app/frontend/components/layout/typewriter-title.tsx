import { useCallback, useEffect, useRef, useState } from "react";

const HIRAGANA =
  "あいうえおかきくけこさしすせそたちつてとなにぬねのはひふへほまみむめもやゆよらりるれろわをん";
const DELETE_SPEED_MS = 60;
const TYPE_SPEED_MS = 80;
const PAUSE_MS = 2000;
const DEFAULT_TEXT = "やんてね！";

type TypewriterTitleProps = {
  readonly className?: string;
};

export function TypewriterTitle({
  className,
}: TypewriterTitleProps): React.JSX.Element {
  const [displayText, setDisplayText] = useState(DEFAULT_TEXT);
  const isAnimatingRef = useRef(false);
  const timeoutsRef = useRef<readonly ReturnType<typeof setTimeout>[]>([]);

  const clearAllTimeouts = useCallback((): void => {
    for (const t of timeoutsRef.current) {
      clearTimeout(t);
    }
    timeoutsRef.current = [];
  }, []);

  const delay = useCallback(
    (ms: number): Promise<void> =>
      new Promise((resolve) => {
        const t = setTimeout(resolve, ms);
        timeoutsRef.current = [...timeoutsRef.current, t];
      }),
    [],
  );

  const animate = useCallback(async (): Promise<void> => {
    if (isAnimatingRef.current) return;
    isAnimatingRef.current = true;

    // eslint-disable-next-line sonarjs/pseudo-random -- UI animation, not security-critical
    const randomIndex = Math.floor(Math.random() * HIRAGANA.length);
    const randomChar = HIRAGANA.charAt(randomIndex) || "あ";

    const phases = [
      { text: `${randomChar}んてね…`, pauseAfter: PAUSE_MS },
      { text: "なんてね？", pauseAfter: PAUSE_MS },
      { text: DEFAULT_TEXT, pauseAfter: 0 },
    ];

    let current = DEFAULT_TEXT;

    for (const phase of phases) {
      // Delete characters one by one
      while (current.length > 0) {
        current = current.slice(0, -1);
        setDisplayText(current);
        await delay(DELETE_SPEED_MS);
      }

      // Type characters one by one
      for (const char of phase.text) {
        current = current + char;
        setDisplayText(current);
        await delay(TYPE_SPEED_MS);
      }

      // Pause before next phase
      if (phase.pauseAfter > 0) {
        await delay(phase.pauseAfter);
      }
    }

    isAnimatingRef.current = false;
  }, [delay]);

  useEffect(() => {
    return clearAllTimeouts;
  }, [clearAllTimeouts]);

  const handleMouseEnter = useCallback((): void => {
    void animate();
  }, [animate]);

  return (
    <span
      className={`cursor-default select-none ${className ?? ""}`}
      onMouseEnter={handleMouseEnter}
    >
      {displayText}
      <span className="ml-0.5 font-normal [animation:blink_1s_step-end_infinite]">
        _
      </span>
    </span>
  );
}
