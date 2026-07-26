import { SiBluesky, SiDiscord, SiGithub, SiX } from "react-icons/si";
import { Celestim } from "./celestim";
import yanteneIcon from "~/frontend/assets/yantene-icon.svg";

const skills = [
  "Web",
  "GNU/Linux",
  "Ruby",
  "Rails",
  "TypeScript",
  "Hono",
  "React",
  "Inertia.js",
  "AWS",
  "Cloudflare",
] as const;

const socialLinks = [
  { label: "GitHub", href: "https://github.com/yantene", icon: SiGithub },
  { label: "X", href: "https://x.com/yantene", icon: SiX },
  {
    label: "Bluesky",
    href: "https://bsky.app/profile/yantene.net",
    icon: SiBluesky,
  },
  {
    label: "Discord",
    href: "https://discord.com/users/yantene",
    icon: SiDiscord,
  },
] as const;

export function HeroSection(): React.JSX.Element {
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      {/* 天体アニメの空 (Celestim)。文字を載せるので読みやすさ用のヴェールを有効にする。 */}
      <div className="absolute inset-0">
        <Celestim veil />
      </div>

      {/*
        空の上のガラス面。白の重ねは Celestim 側のヴェールが時間帯に応じて担うので、
        ここでは輪郭をわずかに和らげるだけに留める (強いブラーは太陽を溶かして消す)。
      */}
      <div className="relative flex items-center justify-center px-6 py-20 backdrop-blur-[2px] sm:py-24">
        <div className="flex w-full max-w-4xl flex-col items-center gap-10 sm:flex-row sm:gap-14">
          {/* アイコン: 清潔なリング + 柔らかい影 (青グローは廃止)。 */}
          <img
            src={yanteneIcon}
            alt="やんてね"
            className="h-32 w-32 shrink-0 rounded-full ring-1 ring-border [box-shadow:0_14px_36px_-10px_rgb(27_36_64/28%)] sm:h-40 sm:w-40"
          />

          {/* プロフィール。 */}
          <div className="flex flex-col items-center gap-5 text-center sm:items-start sm:text-left">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
                Web Developer
              </span>
              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
                やんてね
              </h1>
            </div>

            {/*
              白地前提の text-muted-foreground (62% 透過) は、動く空の上では夜側で
              4.5:1 を割る。ヒーロー内の副次テキストは全周期で AA を満たす濃さにする。
            */}
            <p className="max-w-md text-[0.95rem] leading-relaxed text-foreground/80">
              現実に屈しかけている自由ソフトウェア主義者^H^H^H愛好家です。
              <br />
              ブラウザの向こう側で暮らしています。
            </p>

            <div className="flex flex-wrap justify-center gap-1.5 sm:justify-start">
              {skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full border border-border bg-white/50 px-2.5 py-0.5 text-[0.72rem] font-medium text-foreground/80"
                >
                  {skill}
                </span>
              ))}
            </div>

            <div className="mt-1 flex items-center gap-4">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lg text-foreground/80 transition-colors hover:text-primary"
                  title={link.label}
                >
                  <link.icon />
                </a>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
