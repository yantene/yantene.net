import { Link } from "react-router";
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
          : "sticky top-0 z-50 border-b border-border/50 [animation:sky-color-cycle_288s_linear_infinite]"
      }
    >
      <div className={isTransparent ? "" : "bg-white/60 backdrop-blur-sm"}>
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <TypewriterTitle className="text-xl font-bold tracking-tight text-foreground text-halo" />
          <nav className="flex items-center gap-6 text-halo">
            <Link
              to="/"
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
            >
              Home
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
