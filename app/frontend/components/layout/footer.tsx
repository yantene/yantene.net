import { FeedLink } from "~/frontend/components/feed/feed-link";

type FooterProps = {
  /*
   * 著作権表示に出す年。ここでは決めず、loader が決めたものを受け取る。
   *
   * 素のコンポーネントのままにしてあるのは、渡し忘れたページを型で落とすため。root の
   * loader から useRouteLoaderData で引くと、Storybook やテストでも data router を
   * 用意する羽目になるうえ、渡し忘れが実行時まで表に出ない。
   *
   * なぜ描画側で時計を読まないのかは ~/lib/current-year を参照。
   */
  readonly year: number;
};

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
    </footer>
  );
}
