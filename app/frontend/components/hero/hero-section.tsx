import { SiBluesky, SiDiscord, SiGithub, SiX } from "react-icons/si";
import { Celestim } from "./celestim";
import { Cityscape } from "./cityscape";
import { TimeScrubber } from "./time-scrubber";
import Highlight from "~/frontend/assets/highlight.svg?react";

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
    <section className="hero-clock relative overflow-hidden border-b border-border/60">
      {/* 天体アニメの空 (Celestim)。文字を載せるので読みやすさ用のヴェールを有効にする。 */}
      <div className="absolute inset-0">
        <Celestim veil />
      </div>

      {/* 空の手前に街。テキストは街の線画に重なってよい (線が薄いので読める)。 */}
      <Cityscape />

      <div className="hero-intro relative flex flex-col items-center gap-5 px-6 text-center">
        <span className="text-xs font-semibold uppercase tracking-[0.22em] text-primary">
          Web Developer
        </span>

        <h1 className="hero-heading text-5xl font-bold tracking-tight text-foreground sm:text-6xl">
          <Highlight className="hero-heading-highlight" aria-hidden="true" />
          <span className="relative">やんてね</span>
        </h1>

        {/*
          白地前提の text-muted-foreground (62% 透過) は、動く空の上では夜側で
          4.5:1 を割る。ヒーロー内の副次テキストは全周期で AA を満たす濃さにする。
        */}
        <p className="max-w-xl text-[0.95rem] leading-relaxed text-foreground/80">
          現実に屈しかけている自由ソフトウェア主義者^H^H^H愛好家です。
          <br />
          ブラウザの向こう側で暮らしています。
          <br />
          コードと文章と、Linux と音楽があればだいたい幸せです。
        </p>

        <div className="mt-1 flex items-center gap-5">
          {socialLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-2xl text-foreground/80 transition-colors hover:text-primary"
              title={link.label}
            >
              <link.icon />
            </a>
          ))}
        </div>
      </div>

      {/* 地平線の上を歩く人と、掴んで時間を進められる目盛り。 */}
      <TimeScrubber />
    </section>
  );
}
