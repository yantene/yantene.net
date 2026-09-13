import { SiBluesky, SiDiscord, SiGithub, SiMastodon, SiX } from "react-icons/si";

/*
 * 出ていく先。
 *
 * `isMe` は「これは自分のアカウントである」という主張 (`rel="me"`) を出すかどうか。
 * **主張は相手側からの相互リンクがあって初めて成り立つ**ので、プロフィールに
 * yantene.net を書いてあるものだけに付ける。書いていない先に付けると、確かめた側から
 * 見て嘘になる。
 *
 * Discord は公開プロフィールに相互リンクを置けないため付けない。X は Bridgy が
 * 2023 年に対応を終えており、反応を持ち帰る先にならないので今は付けない。
 *
 * **いま読んでいるのはヒーローだけ。** 帯とドロワーからは外してある (行き先と道具を
 * 並べる場所に「誰か」の情報は属さない)。それでも表として括り出しておくのは、
 * プロフィール (#413) が同じ並びを出すため。書き写すと、増やしたときに片方だけ古びる。
 */
export const socialLinks = [
  {
    label: "GitHub",
    href: "https://github.com/yantene",
    icon: SiGithub,
    isMe: true,
  },
  { label: "X", href: "https://x.com/yantene", icon: SiX, isMe: false },
  {
    label: "Bluesky",
    href: "https://bsky.app/profile/yantene.net",
    icon: SiBluesky,
    isMe: true,
  },
  {
    label: "Mastodon",
    href: "https://mastodon.social/@yantene",
    icon: SiMastodon,
    isMe: true,
  },
  {
    label: "Discord",
    href: "https://discord.com/users/yantene",
    icon: SiDiscord,
    isMe: false,
  },
] as const satisfies readonly {
  label: string;
  href: string;
  icon: React.ComponentType;
  isMe: boolean;
}[];

/**
 * `rel` の中身。`me` を足すかどうかだけが違う。
 *
 * `noopener noreferrer` はどちらにも付ける。開いた先から `window.opener` を辿られない
 * ようにするためで、自分のアカウントかどうかとは関係が無い。
 */
function relFor(isMe: boolean): string {
  return isMe ? "me noopener noreferrer" : "noopener noreferrer";
}

interface SocialLinksProps {
  /** 並べ方。置き場所 (ヒーローの中央揃え・ヘッダーの右端) で違うので呼ぶ側が決める。 */
  readonly className?: string;
  /** 絵 1 つぶんの大きさと色。既定値は無い (地の色が場所ごとに違うため)。 */
  readonly linkClassName: string;
}

/**
 * ソーシャルメディアへ出ていく導線。
 *
 * 絵しか出さないので、名前は `aria-label` で渡す。`title` も置くのは、マウスで
 * 指したときに何のアイコンか読めるようにするため (`aria-label` は目で見えない)。
 */
export function SocialLinks({ className, linkClassName }: SocialLinksProps): React.JSX.Element {
  return (
    <ul className={className}>
      {/*
        項目は `flex`。既定の `<li>` は中に行ボックスを作るので、絵がベースラインに乗って
        **下にディセンダ分の空きが残る**。並べたときに絵だけが 3px ほど上へ浮いて見える。
      */}
      {socialLinks.map((link) => (
        <li key={link.label} className="flex">
          <a
            href={link.href}
            target="_blank"
            rel={relFor(link.isMe)}
            className={linkClassName}
            aria-label={link.label}
            title={link.label}
          >
            <link.icon aria-hidden />
          </a>
        </li>
      ))}
    </ul>
  );
}
