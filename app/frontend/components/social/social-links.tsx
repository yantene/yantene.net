import { HiEnvelope } from "react-icons/hi2";
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
type SocialIcon = React.ComponentType<{
  readonly className?: string;
  readonly "aria-hidden"?: boolean;
}>;

const socialIcons: Record<SocialPlatform, SocialIcon> = {
  github: SiGithub,
  x: SiX,
  bluesky: SiBluesky,
  mastodon: SiMastodon,
  discord: SiDiscord,
  /*
   * メールだけは誰のロゴでもないので、素材も Simple Icons ではない。塗りの封筒を使う
   * のは、線の絵だと 1 つだけ細く見えて並びが崩れるため。大きさの補正は
   * `social-links.css` が持つ。
   */
  email: HiEnvelope,
};

/** メールだけ、リンクの張り方が他と違う (別タブで開かない・`u-email` を名乗る)。 */
function isEmail(platform: SocialPlatform): boolean {
  return platform === "email";
}

/**
 * `rel` の中身。`me` を足すかどうかだけが違う。
 *
 * `me` は「これは自分のアカウントである」という主張で、**相手側からの相互リンクが
 * あって初めて成り立つ**。先方のプロフィールに yantene.net を書いた先にだけ立てる
 * (判断は書き手がフロントマターで行う)。
 *
 * `noopener noreferrer` は、**別の文書を開く先には** `isMe` によらず付ける。開いた先から
 * `window.opener` を辿られないようにするためで、自分のアカウントかどうかとは関係が無い。
 * メール (`mailto:`) は文書を開かないので付けない (下記)。
 */
function relFor(isMe: boolean, platform: SocialPlatform): string | undefined {
  /*
   * `mailto:` は別の文書を開かないので `noopener` / `noreferrer` に意味が無い。
   * `me` のほうは効く (RelMeAuth はメールアドレスも身元として辿る)。
   */
  if (isEmail(platform)) return isMe ? "me" : undefined;
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
        const email = isEmail(link.platform);
        return (
          <li key={`${link.platform}:${link.url}`} className="flex">
            {/*
              メールは別タブで開かない。`mailto:` に `target="_blank"` を付けると、
              メーラーが立ち上がったうえで空のタブが 1 枚残る。

              `u-email` は h-card の連絡先。`mailto:` のリンクに付けると、読んだ側が
              「この人に届く宛先」として拾える (`u-url` や `u-photo` と同じ役)。
            */}
            <a
              href={link.url}
              target={email ? undefined : "_blank"}
              rel={relFor(link.isMe, link.platform)}
              className={`social-link social-link-${link.platform}${email ? " u-email" : ""} ${linkClassName}`}
              aria-label={label}
              title={label}
            >
              {/*
                `brand-mark` はよその会社の印にだけ付ける。色を変えてはいけないという
                規定があるのがそちらだから (ADR 0043)。封筒は誰のロゴでもないので
                付けない。黒で出すのは並びを揃えるためで、規定によるものではない。
              */}
              <Icon className={email ? undefined : "brand-mark"} aria-hidden />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
