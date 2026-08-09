import { FeedLink } from "~/frontend/components/feed/feed-link";

// ページの足元の地面。地平線を一本引くだけに留める (見た目は footer.css が持つ)。
const currentYear = new Date().getFullYear();

export function Footer(): React.JSX.Element {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
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
