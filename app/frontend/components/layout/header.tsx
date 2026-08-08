import { Link } from "react-router";
import { TypewriterTitle } from "./typewriter-title";

type HeaderProps = {
  readonly variant?: "solid" | "transparent";
};

export function Header({ variant = "solid" }: HeaderProps): React.JSX.Element {
  const isTransparent = variant === "transparent";

  // 透過時は動く空の上に載る。白地前提の text-muted-foreground (62% 透過) では
  // 夜側でコントラストが 4.5:1 を割るため、濃いめの色に切り替える。
  const linkClassName = `text-sm font-medium transition-colors hover:text-primary ${
    isTransparent ? "text-foreground/80" : "text-muted-foreground"
  }`;

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
            <Link to="/" className={linkClassName}>
              Home
            </Link>
            <Link to="/notes" className={linkClassName}>
              Notes
            </Link>
            <Link to="/tags" className={linkClassName}>
              Tags
            </Link>
            <Link to="/search" aria-label="Search" className={linkClassName}>
              Search
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
