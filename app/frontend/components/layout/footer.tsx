import { FeedLink } from "~/frontend/components/feed/feed-link";

interface FooterProps {
  /**
   * 著作権表示に出す年。ここで時計を読まず loader が決めた年を受け取るのは、
   * SSR とクライアントで必ず同じ年を出すため (理由は current-year.ts に書いてある)。
   */
  readonly year: number;
}

// ページの足元の地面。地平線を一本引くだけに留める (見た目は footer.css が持つ)。
export function Footer({ year }: FooterProps): React.JSX.Element {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <p className="text-xs text-foreground/80">&copy; {year} yantene.net</p>
        {/*
          全ページの足元に置く常設の購読導線。読み終えて出ていく場所が、
          この先も繋がっていられることを示すのに一番近い。
        */}
        <FeedLink className="text-xs text-foreground/80" />
      </div>
      {/*
        絵文字の意匠の出どころ。CC-BY 4.0 が求める帰属で、外せない。
        Twemoji 側は「README か About かフッターに一言」で足りるとしているので、
        本文の邪魔にならない大きさで足元に置く。
      */}
      <p className="site-footer-attribution">
        絵文字は{" "}
        <a
          href="https://github.com/jdecked/twemoji"
          target="_blank"
          rel="noreferrer"
          className="press-control hover:text-primary hover:underline"
        >
          Twemoji
        </a>{" "}
        (CC BY 4.0)
      </p>
    </footer>
  );
}
