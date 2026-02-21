import { Link } from "react-router";

type HeaderProps = {
  readonly variant?: "solid" | "transparent";
};

export function Header({
  variant = "solid",
}: HeaderProps): React.JSX.Element {
  const isTransparent = variant === "transparent";

  return (
    <header
      className={
        isTransparent
          ? "absolute inset-x-0 top-0 z-50"
          : "sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md"
      }
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link
          to="/"
          className={`text-xl font-bold tracking-tight transition-colors hover:text-primary ${
            isTransparent
              ? "text-foreground text-halo"
              : "text-foreground"
          }`}
        >
          やんてね！
        </Link>
        <nav
          className={`flex items-center gap-6 ${isTransparent ? "text-halo" : ""}`}
        >
          <Link
            to="/"
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            Home
          </Link>
        </nav>
      </div>
    </header>
  );
}
