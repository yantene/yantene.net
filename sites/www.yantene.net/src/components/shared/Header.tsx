import Image from "next/image";
import Link from "next/link";
import HeaderMenuButton from "./HeaderMenuButton";
import HeaderSearchButton from "./HeaderSearchButton";
import { styles } from "./header.css";
import { size } from "../../variables/size";

export default function Header(): JSX.Element {
  return (
    <header className={styles.header}>
      <div className={styles.rightArea}>
        <HeaderMenuButton />
        <Link href="/" className={styles.logoLink}>
          <Image
            className={styles.logoImage}
            src="/images/logo.svg"
            alt="やんてね！"
            width={120}
            height={size.header.height - 16}
          />
        </Link>
      </div>
      <div className={styles.centerArea}></div>
      <div className={styles.leftArea}>
        <HeaderSearchButton />
      </div>
    </header>
  );
}
