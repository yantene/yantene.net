import { styles } from "./overlay.css";

export default function Overlay({
  show,
  onClick,
}: {
  show: boolean;
  onClick: () => void;
}): JSX.Element {
  return (
    <div
      onClick={onClick}
      className={`${styles.overlay} ${show ? styles.show : ""}`}
    />
  );
}
