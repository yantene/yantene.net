const SOCIAL_LINKS = [
  { label: "GitHub", href: "https://github.com/yantene" },
] as const;

const CURRENT_YEAR = new Date().getFullYear();

export function Footer(): React.JSX.Element {
  return (
    <footer className="border-t border-border/50 bg-muted/30">
      <div className="mx-auto flex max-w-5xl flex-col items-center gap-4 px-6 py-8 sm:flex-row sm:justify-between">
        <nav className="flex items-center gap-6">
          {SOCIAL_LINKS.map((link) => (
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
          &copy; {CURRENT_YEAR} yantene
        </p>
      </div>
    </footer>
  );
}
