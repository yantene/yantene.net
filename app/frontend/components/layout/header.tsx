import { Link } from "react-router";

export function Header(): React.JSX.Element {
  return (
    <header className="sticky top-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link
          to="/"
          className="text-xl font-bold tracking-tight text-foreground transition-colors hover:text-primary"
        >
          <span className="text-primary">yan</span>tene.net
        </Link>
        <nav className="flex items-center gap-6">
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
