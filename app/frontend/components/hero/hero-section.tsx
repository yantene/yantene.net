const skills = [
  "TypeScript",
  "React",
  "Cloudflare Workers",
  "Hono",
  "Rust",
] as const;

const socialLinks = [
  { label: "GitHub", href: "https://github.com/yantene" },
  { label: "X", href: "https://x.com/yantene" },
] as const;

export function HeroSection(): React.JSX.Element {
  return (
    <section className="relative overflow-hidden border-b border-border/50 bg-gradient-to-br from-background via-background to-secondary/50 py-16 sm:py-24">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--neon-cyan)_0%,_transparent_50%)] opacity-5" />
      <div className="relative mx-auto flex max-w-5xl flex-col items-center gap-8 px-6 sm:flex-row sm:items-start sm:gap-12">
        <div className="relative shrink-0">
          <div className="h-32 w-32 overflow-hidden rounded-full border-2 border-primary/30 bg-muted neon-glow-cyan sm:h-40 sm:w-40">
            <div className="flex h-full w-full items-center justify-center text-4xl text-muted-foreground sm:text-5xl">
              Y
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4 text-center sm:items-start sm:text-left">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              yantene
            </h1>
            <p className="mt-2 text-lg text-muted-foreground">
              自己表現・技術実験・発信の場
            </p>
          </div>

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
                className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
