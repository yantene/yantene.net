"use client";

import { useAtom } from "jotai";
import { FaBars, FaXmark } from "react-icons/fa6";
import { menuOpenAtom } from "../../stores/menuOpenAtom";
import { styles } from "./headerMenuButton.css";

export default function HeaderMenuButton() {
  const [menuOpen, setMenuOpen] = useAtom(menuOpenAtom);

  return (
    <button onClick={() => setMenuOpen(!menuOpen)} className={styles.button}>
      {menuOpen ? <FaXmark size={30} /> : <FaBars size={30} />}
    </button>
  );
}
