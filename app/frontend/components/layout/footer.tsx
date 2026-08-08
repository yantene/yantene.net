// フッター帯も Celestim と同じ空のサイクルで塗る (見た目は footer.css が持つ)。
const currentYear = new Date().getFullYear();

export function Footer(): React.JSX.Element {
  return (
    <footer className="footer-daylight relative border-t border-border/50">
      <div className="mx-auto flex max-w-5xl items-center justify-center px-6 py-8">
        <p className="text-xs text-foreground/80">
          &copy; {currentYear} yantene.net
        </p>
      </div>
    </footer>
  );
}
