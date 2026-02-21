import { SiBluesky, SiDiscord, SiGithub, SiX } from "react-icons/si";
import yanteneIcon from "~/frontend/assets/yantene-icon.svg";
import { Celestim } from "./celestim";

const skills = [
  "TypeScript",
  "React",
  "Cloudflare Workers",
  "Hono",
  "Rust",
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
    <section className="relative overflow-hidden border-b border-border/50">
      {/* Celestim background layer */}
      <div className="absolute inset-0">
        <Celestim />
      </div>

      {/* Frosted glass overlay */}
      <div className="relative flex items-center justify-center bg-white/40 px-6 py-16 backdrop-blur-[2px] sm:py-24">
        <div className="flex max-w-5xl flex-col items-center gap-8 sm:flex-row sm:items-start sm:gap-12">
          {/* Icon */}
          <div className="relative shrink-0">
            <img
              src={yanteneIcon}
              alt="やんてね"
              className="h-32 w-32 rounded-full border-2 border-primary/30 neon-glow-cyan sm:h-40 sm:w-40"
            />
          </div>

          {/* Profile */}
          <div className="flex flex-col items-center gap-4 text-halo text-center sm:items-start sm:text-left">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                やんてね
              </h1>
              <p className="mt-1 text-sm font-medium text-primary">
                ソフトウェアエンジニア
              </p>
            </div>

            <p className="max-w-lg text-sm leading-relaxed text-muted-foreground">
              自己表現・技術実験・発信の場。TypeScript と Rust
              が好きで、Web
              技術を中心にものづくりをしています。
            </p>

            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              {skills.map((skill) => (
                <span
                  key={skill}
                  className="rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-medium text-primary"
                >
                  {skill}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-4">
              {socialLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-lg text-muted-foreground transition-colors hover:text-primary"
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
