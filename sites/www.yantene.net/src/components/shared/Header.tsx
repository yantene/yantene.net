import { styles } from "./header.css";

import Image from "next/image";

export default function Header() {
  return (
    <header className={styles.header}>
      <Image
        className={styles.logo}
        src="/images/logo.svg"
        alt="やんてね！"
        width={200}
        height={54}
      />
    </header>
  );
}
