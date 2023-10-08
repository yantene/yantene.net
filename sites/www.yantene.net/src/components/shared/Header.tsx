import Image from "next/image";
import HeaderMenuButton from "./HeaderMenuButton";
import HeaderSearchButton from "./HeaderSearchButton";
import { styles } from "./header.css";

export default function Header(): JSX.Element {
  return (
    <header className={styles.header}>
      <div className={styles.rightArea}>
        <HeaderMenuButton />
      </div>
      <div className={styles.centerArea}>
        <Image
          className={styles.logo}
          src="/images/logo.svg"
          alt="やんてね！"
          width={200}
          height={54}
        />
      </div>
      <div className={styles.leftArea}>
        <HeaderSearchButton />
      </div>
    </header>
  );
}
