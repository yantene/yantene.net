import { styles } from "./headerSearchButton.css";

import { FaMagnifyingGlass } from "react-icons/fa6";

export default function HeaderSearchButton() {
  return (
    <button className={styles.button}>
      <FaMagnifyingGlass size={30} />
    </button>
  );
}
