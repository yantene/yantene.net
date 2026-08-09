import { FeedLink } from "~/frontend/components/feed/feed-link";

// ページの足元に敷く地面。空の色は上端の細い帯にだけ残す (見た目は footer.css が持つ)。
const currentYear = new Date().getFullYear();

export function Footer(): React.JSX.Element {
  return (
    <footer className="site-footer">
      {/*
        トップの街と地続きの地面。どのページも最後はここへ着地する。
        絵は背景として横に敷き詰めるので、要素そのものは空にしておく。
      */}
      <div className="site-footer-ground" aria-hidden="true" />

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
