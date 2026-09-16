import { SiBluesky, SiDiscord, SiGithub, SiMastodon, SiX } from "react-icons/si";
import type { PublicSocialAccount } from "~/backend/handlers/profile/profile-view";
import type { SocialPlatform } from "~/lib/social-platforms";
import { socialPlatformLabels } from "~/lib/social-platforms";

/*
 * 出ていく先。
 *
 * **どの先を出すかはコンテンツリポジトリのプロフィールが持つ。** ここにあるのは種類ごとの絵だけで、
 * URL も `rel="me"` を出すかどうかも書き手が決める。アイコンはコンポーネントの参照
 * なのでコンテンツ側に置けず、種類の名前 (`app/lib/social-platforms.ts`) だけを
 * 待ち合わせ場所にしている。
 */
/*
 * 印の素材。**`className` を受け取れる型で持つ。**
 *
 * 描くときに `brand-mark` を付けるため (色は `brand-marks.css` が 1 か所で決める)。
 * `React.ComponentType` のままだと class を渡せず、色が周りの字から流れ込む。
 */
type BrandIcon = React.ComponentType<{
  readonly className?: string;
  readonly "aria-hidden"?: boolean;
}>;

const socialIcons: Record<SocialPlatform, BrandIcon> = {
  github: SiGithub,
  x: SiX,
  bluesky: SiBluesky,
  mastodon: SiMastodon,
  discord: SiDiscord,
};

/**
 * `rel` の中身。`me` を足すかどうかだけが違う。
 *
 * `me` は「これは自分のアカウントである」という主張で、**相手側からの相互リンクが
 * あって初めて成り立つ**。先方のプロフィールに yantene.net を書いた先にだけ立てる
 * (判断は書き手がフロントマターで行う)。
 *
 * `noopener noreferrer` はどちらにも付ける。開いた先から `window.opener` を辿られない
 * ようにするためで、自分のアカウントかどうかとは関係が無い。
 */
function relFor(isMe: boolean): string {
  return isMe ? "me noopener noreferrer" : "noopener noreferrer";
}

interface SocialLinksProps {
  /** 出す先。プロフィールが無いときは空で渡す (何も描かない)。 */
  readonly links: readonly PublicSocialAccount[];
  /** 並べ方。置き場所 (ヒーローの中央揃え・`/about` の左寄せ) で違うので呼ぶ側が決める。 */
  readonly className?: string;
  /**
   * 絵 1 つぶんの大きさ。`font-size` を決めるクラスを渡す (台も絵も em で従う)。
   *
   * **色は渡さない。** 渡しても `.social-link` が勝つ。ブランド規定の話なので、
   * 置き場所の都合で変えられる軸にしていない。
   */
  readonly linkClassName: string;
}

/**
 * ソーシャルメディアへ出ていく導線。
 *
 * 絵しか出さないので、名前は `aria-label` で渡す。`title` も置くのは、マウスで
 * 指したときに何のアイコンか読めるようにするため (`aria-label` は目で見えない)。
 *
 * **絵の色と台は `social-links.css` が持ち、呼ぶ側は選べない。** 各社のブランド規定で
 * 黒 (または白) 以外に染めることが禁じられているため、置き場所ごとに色を渡せる作りに
 * しない。`linkClassName` に渡すのは大きさと `press-control` だけ。
 */
export function SocialLinks({
  links,
  className,
  linkClassName,
}: SocialLinksProps): React.JSX.Element {
  return (
    <ul className={className}>
      {/*
        項目は `flex`。既定の `<li>` は中に行ボックスを作るので、絵がベースラインに乗って
        **下にディセンダ分の空きが残る**。並べたときに絵だけが 3px ほど上へ浮いて見える。
      */}
      {links.map((link) => {
        const Icon = socialIcons[link.platform];
        const label = socialPlatformLabels[link.platform];
        return (
          <li key={`${link.platform}:${link.url}`} className="flex">
            <a
              href={link.url}
              target="_blank"
              rel={relFor(link.isMe)}
              className={`social-link social-link-${link.platform} ${linkClassName}`}
              aria-label={label}
              title={label}
            >
              <Icon className="brand-mark" aria-hidden />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
