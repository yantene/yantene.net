// フッター帯も Celestim と同じ空のサイクルで塗る (keyframes は app.css 経由で届く)。
const currentYear = new Date().getFullYear();

export function Footer(): React.JSX.Element {
  return (
    <footer className="relative border-t border-border/50 [animation:celestim-veiled-sky-cycle_288s_linear_infinite]">
      <div className="mx-auto flex max-w-5xl items-center justify-center px-6 py-8">
        <p className="text-xs text-foreground/80">
          &copy; {currentYear} yantene.net
        </p>
      </div>
    </footer>
  );
}
