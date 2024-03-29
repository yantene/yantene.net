"use client";

import Link from "next/link";
import { useAtom } from "jotai";
import {
  FaHouseChimney,
  FaFaceKissWinkHeart,
  FaNoteSticky,
  FaCommentDots,
  FaGithub,
  FaCircle,
  FaMastodon,
} from "react-icons/fa6";
import { styles } from "./menu.css";

import { menuOpenAtom } from "../../stores/menuOpenAtom";
import Overlay from "./Overlay";

export default function Menu(): JSX.Element {
  const iconSize = 32;

  const [menuOpen, setMenuOpen] = useAtom(menuOpenAtom);

  return (
    <>
      <Overlay show={menuOpen} onClick={(): void => setMenuOpen(false)} />
      <aside className={`${styles.aside} ${menuOpen ? styles.open : ""}`}>
        <nav>
          <ul className={styles.list}>
            <li className={styles.item}>
              <Link href="/" className={styles.itemAnchor}>
                <div className={styles.itemIcon}>
                  <FaHouseChimney size={iconSize} />
                </div>
                <span className={styles.itemLabel}>Top</span>
              </Link>
            </li>
            <li className={styles.item}>
              <Link href="/profile" className={styles.itemAnchor}>
                <div className={styles.itemIcon}>
                  <FaFaceKissWinkHeart size={iconSize} />
                </div>
                <span className={styles.itemLabel}>Profile</span>
              </Link>
            </li>
            <li className={styles.item}>
              <Link href="/notes" className={styles.itemAnchor}>
                <div className={styles.itemIcon}>
                  <FaNoteSticky size={iconSize} />
                </div>
                <span className={styles.itemLabel}>Notes</span>
              </Link>
            </li>
            <li className={styles.item}>
              <Link href="/social" className={styles.itemAnchor}>
                <div className={styles.itemIcon}>
                  <FaCommentDots size={iconSize} />
                </div>
                <span className={styles.itemLabel}>Social</span>
              </Link>
            </li>
            <li className={styles.item}>
              <a
                href="https://github.com/yantene"
                target="_blank"
                className={styles.itemAnchor}
              >
                <div className={styles.itemIcon}>
                  <FaGithub size={iconSize} />
                </div>
                <span className={styles.itemLabel}>GitHub</span>
              </a>
            </li>
            <li className={styles.item}>
              <a
                href="https://bsky.app/profile/yantene.net"
                target="_blank"
                className={styles.itemAnchor}
              >
                <div className={styles.itemIcon}>
                  <FaCircle size={iconSize} />
                </div>
                <span className={styles.itemLabel}>Bluesky</span>
              </a>
            </li>
            <li className={styles.item}>
              <a
                href="https://fla.red/@yantene"
                target="_blank"
                className={styles.itemAnchor}
              >
                <div className={styles.itemIcon}>
                  <FaMastodon size={iconSize} />
                </div>
                <span className={styles.itemLabel}>Fla.red</span>
              </a>
            </li>
          </ul>
        </nav>
      </aside>
    </>
  );
}
