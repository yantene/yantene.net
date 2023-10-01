import { FaMagnifyingGlass } from "react-icons/fa6";
import { styles } from "./headerSearchButton.css";

export default function HeaderSearchButton(): JSX.Element {
  return (
    <button className={styles.button}>
      <FaMagnifyingGlass size={30} />
    </button>
  );
}
