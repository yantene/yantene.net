import { SiBluesky, SiDiscord, SiGithub, SiMastodon, SiX } from "react-icons/si";
import type { SocialLink, SocialPlatform } from "~/backend/domain/profile";

/*
 * 出ていく先。
 *
 * `isMe` は「これは自分のアカウントである」という主張 (`rel="me"`) を出すかどうか。
 * **主張は相手側からの相互リンクがあって初めて成り立つ**ので、プロフィールに
 * yantene.net を書いてあるものだけに付ける。書いていない先に付けると、確かめた側から
 * 見て嘘になる。
 *
 * Discord は公開プロフィールに相互リンクを置けないため付けない。
 *
 * **いま読んでいるのはヒーローだけ。** 帯とドロワーからは外してある (行き先と道具を
 * 並べる場所に「誰か」の情報は属さない)。`/about` はこの並びではなく、コンテンツ
 * リポジトリの `profile.md` が持つ並びを `links` で渡して描く (ADR 0041)。ここが
 * 既定値として残っているのは、プロフィールをまだ同期していないトップのため。
 */
export const socialLinks = [
  {
    label: "GitHub",
    href: "https://github.com/yantene",
    icon: SiGithub,
    isMe: true,
  },
  { label: "X", href: "https://x.com/yantene", icon: SiX, isMe: true },
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

/**
 * `platform` から絵と表示名への表。
 *
 * **絵はコンポーネントの参照なのでコンテンツ側に置けない。** URL と `isMe` を
 * `profile.md` に、この表をコードに置く分担で、二重管理ではない。ここに無い
 * `platform` は同期の時点で弾いてある (services/profile-refresh.service.ts)。
 */
const platformIcons = {
  github: { label: "GitHub", icon: SiGithub },
  x: { label: "X", icon: SiX },
  bluesky: { label: "Bluesky", icon: SiBluesky },
  mastodon: { label: "Mastodon", icon: SiMastodon },
  discord: { label: "Discord", icon: SiDiscord },
} as const satisfies Record<SocialPlatform, { label: string; icon: React.ComponentType }>;

/** 描画に要る形。既定値の表も `profile.md` 由来の並びも、この形に揃えてから渡す。 */
interface DisplaySocialLink {
  readonly label: string;
  readonly href: string;
  readonly icon: React.ComponentType;
  readonly isMe: boolean;
}

/** `profile.md` 由来の並びを、絵を添えた形にする。 */
export function toDisplaySocialLinks(links: readonly SocialLink[]): readonly DisplaySocialLink[] {
  return links.map((link) => ({
    label: platformIcons[link.platform].label,
    href: link.url,
    icon: platformIcons[link.platform].icon,
    isMe: link.isMe,
  }));
}

interface SocialLinksProps {
  /** 並べ方。置き場所 (ヒーローの中央揃え・ヘッダーの右端) で違うので呼ぶ側が決める。 */
  readonly className?: string;
  /** 絵 1 つぶんの大きさと色。既定値は無い (地の色が場所ごとに違うため)。 */
  readonly linkClassName: string;
  /** 出す並び。省くとコードに持っている既定の表を出す。 */
  readonly links?: readonly DisplaySocialLink[];
}

/**
 * ソーシャルメディアへ出ていく導線。
 *
 * 絵しか出さないので、名前は `aria-label` で渡す。`title` も置くのは、マウスで
 * 指したときに何のアイコンか読めるようにするため (`aria-label` は目で見えない)。
 */
export function SocialLinks({
  className,
  linkClassName,
  links = socialLinks,
}: SocialLinksProps): React.JSX.Element {
  return (
    <ul className={className}>
      {/*
        項目は `flex`。既定の `<li>` は中に行ボックスを作るので、絵がベースラインに乗って
        **下にディセンダ分の空きが残る**。並べたときに絵だけが 3px ほど上へ浮いて見える。
      */}
      {links.map((link) => (
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
