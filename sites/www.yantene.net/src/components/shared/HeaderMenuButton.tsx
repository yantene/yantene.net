"use client";

import { menuOpenAtom } from "../../stores/menuOpenAtom";
import { useAtom } from "jotai";
import { styles } from "./headerMenuButton.css";

import { FaBars, FaXmark } from "react-icons/fa6";

export default function HeaderMenuButton() {
  const [menuOpen, setMenuOpen] = useAtom(menuOpenAtom);

  return (
    <button onClick={() => setMenuOpen(!menuOpen)} className={styles.button}>
      {menuOpen ? <FaXmark size={30} /> : <FaBars size={30} />}
    </button>
  );
}
