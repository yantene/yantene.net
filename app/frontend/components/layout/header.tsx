import { Link } from "@inertiajs/react";
import { TypewriterTitle } from "./typewriter-title";

type HeaderProps = {
  readonly variant?: "solid" | "transparent";
};

export function Header({ variant = "solid" }: HeaderProps): React.JSX.Element {
  const isTransparent = variant === "transparent";

  return (
    <header
      className={
        isTransparent
          ? "absolute inset-x-0 top-0 z-50"
          : "sticky top-0 z-50 border-b border-border/50"
      }
    >
      <div className={isTransparent ? "" : "bg-white/60 backdrop-blur-sm"}>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <TypewriterTitle
            className={`text-xl font-bold tracking-tight text-foreground${isTransparent ? " text-halo" : ""}`}
          />
          <nav
            className={`flex items-center gap-7 sm:gap-9${isTransparent ? " text-halo" : ""}`}
          >
            <Link
              href="/"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              Home
            </Link>
            <Link
              href="/notes"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              Notes
            </Link>
            <Link
              href="/tags"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              Tags
            </Link>
            <Link
              href="/search"
              aria-label="Search"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              Search
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
