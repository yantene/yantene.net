const socialLinks = [
  { label: "GitHub", href: "https://github.com/yantene" },
] as const;

const currentYear = new Date().getFullYear();

export function Footer(): React.JSX.Element {
  return (
    <footer className="sky-cycle-bg relative border-t border-border/50">
      <div className="relative bg-white/40 backdrop-blur-[2px]">
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 py-8 text-halo sm:flex-row sm:justify-between">
          <nav className="flex items-center gap-6">
            {socialLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground transition-colors hover:text-primary"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <p className="text-xs text-muted-foreground">
            &copy; {currentYear} yantene
          </p>
        </div>
      </div>
    </footer>
  );
}
