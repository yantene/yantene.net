import { FeedLink } from "~/frontend/components/feed/feed-link";

// フッター帯も Celestim と同じ空のサイクルで塗る (見た目は footer.css が持つ)。
const currentYear = new Date().getFullYear();

export function Footer(): React.JSX.Element {
  return (
    <footer className="footer-daylight relative border-t border-border/50">
      <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-6 py-8 sm:flex-row">
        <p className="text-xs text-foreground/80">
          &copy; {currentYear} yantene.net
        </p>
        {/*
          全ページの足元に置く常設の購読導線。読み終えて出ていく場所が、
          この先も繋がっていられることを示すのに一番近い。
        */}
        <FeedLink className="text-xs text-foreground/80" />
      </div>
    </footer>
  );
}
