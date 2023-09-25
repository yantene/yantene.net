"use client";

import { useContext } from "react";
import { styles } from "./headerMenuButton.css";

import { FaBars, FaXmark } from "react-icons/fa6";
import { MenuContext } from "../../contexts/MenuContext";

export default function HeaderMenuButton() {
  const { menuOpen, toggle } = useContext(MenuContext);

  return (
    <button onClick={toggle} className={styles.button}>
      {menuOpen ? <FaXmark size={30} /> : <FaBars size={30} />}
    </button>
  );
}
