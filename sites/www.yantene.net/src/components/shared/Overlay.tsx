import { useEffect, useRef } from "react";
import { styles } from "./overlay.css";

export default function Overlay({
  show,
  onClick,
}: {
  show: boolean;
  onClick: () => void;
}): JSX.Element {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const overlay = overlayRef?.current;

    if (show) {
      overlay?.classList.add(styles.show, styles.smoken);
    } else {
      overlay?.classList.remove(styles.smoken);
      overlay?.addEventListener("transitionend", () => {
        overlay?.classList.remove(styles.show);
      });
    }
  }, [show]);

  return (
    <div onClick={onClick} ref={overlayRef} className={`${styles.overlay}`} />
  );
}
