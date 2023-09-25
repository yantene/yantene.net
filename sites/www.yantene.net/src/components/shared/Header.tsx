import HeaderMenuButton from "./HeaderMenuButton";
import HeaderSearchButton from "./HeaderSearchButton";
import { styles } from "./header.css";

import Image from "next/image";

export default function Header() {
  return (
    <header className={styles.header}>
      <HeaderMenuButton />
      <Image
        className={styles.logo}
        src="/images/logo.svg"
        alt="やんてね！"
        width={200}
        height={54}
      />
      <HeaderSearchButton />
    </header>
  );
}
