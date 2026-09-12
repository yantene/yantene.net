import { useEffect, useState } from "react";
import { Link } from "react-router";
import { LocaleSwitch } from "./locale-switch";
import { SiteMenu } from "./site-menu";
import { SiteNav } from "./site-nav";
import Logo from "~/frontend/assets/yantene-logo.svg?react";
import { FeedIconLink } from "~/frontend/components/feed/feed-link";
import { CommandPalette } from "~/frontend/components/search/command-palette";
import { SearchTrigger } from "~/frontend/components/search/search-trigger";

type HeaderProps = {
  readonly variant?: "solid" | "transparent";
  /*
   * ロゴを出すか。トップはヒーローが同じ「やんてね」を大きく出すので、ヘッダーでは伏せる。
   *
   * variant から暗に導かない。透過ヘッダーはヒーローに重ねるための見た目の話で、ロゴを
   * 出すかどうかは「同じ字がページ内に既にあるか」の話。トップ以外で透過を使いたくなった
   * ときに、ロゴが黙って消えることのないよう別の prop にしてある。
   */
  readonly showLogo?: boolean;
};

/**
 * 字を打ち込んでいる最中か。
 *
 * 打っている場所で `Ctrl+K` を奪わない。macOS の入力欄では行末までの削除に割り当たって
 * いて、奪うと読み手の手癖を壊す。一覧の検索欄で押したときも、そこで打っている人は
 * 既に検索しているので、別の検索を被せる意味が無い。
 */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

export function Header({ variant = "solid", showLogo = true }: HeaderProps): React.JSX.Element {
  const [isSearchOpen, setSearchOpen] = useState(false);
  const isTransparent = variant === "transparent";

  /*
   * `⌘K` と `Ctrl+K` のどちらでも開く。
   *
   * **`Ctrl+K` は Chrome の既定 (アドレス欄で検索) と重なる。** `keydown` で
   * `preventDefault` すればページ側が先に取れるので、GNU/Linux と Windows でも
   * ここで開く。取れない組み合わせ (`Ctrl+T` など) とは違い、これは譲ってもらえる。
   *
   * `Alt` を伴うものは別の組み合わせとして見送る。窓の管理や入力メソッドが
   * `Ctrl+Alt+K` に何かを割り当てていることがある。
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if (event.key.toLowerCase() !== "k") return;
      if (!event.metaKey && !event.ctrlKey) return;
      if (event.altKey) return;
      if (isTyping(event.target)) return;

      event.preventDefault();
      setSearchOpen(true);
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // 透過時は動く空の上に載る。白地前提の text-muted-foreground (62% 透過) では
  // 夜側でコントラストが 4.5:1 を割るため、濃いめの色に切り替える。
  const inkClassName = isTransparent ? "text-foreground/80" : "text-muted-foreground";
  const navLinkClassName = `press-control text-sm font-medium transition-colors hover:text-primary ${inkClassName}`;
  /*
   * 器は検索・表示する言語と同じもの (header.css の .header-icon-link)。
   *
   * 字を 1 段大きく (text-xl) してあるのは、RSS の印が箱の 62.5% しか塗らないため。
   * 隣の虫眼鏡 (81%) と同じ字の大きさにすると、印だけが small に見える。
   *
   * **display はここに入れない。** 出し隠しは使う側が `hidden lg:inline-flex` で載せる。
   * 同じ層の display の指定を 2 つ並べると、勝つのはクラスの並び順ではなく生成された
   * CSS の順になり、どちらが効くのか読めなくなる。
   */
  const iconLinkClassName = `header-icon-link press-control items-center justify-center text-xl transition-colors hover:text-primary ${inkClassName}`;

  return (
    <>
      <header
        className={
          isTransparent ? "absolute inset-x-0 top-0 z-50" : "site-header sticky top-0 z-50"
        }
      >
        <div className={isTransparent ? "" : "bg-white/60 backdrop-blur-sm"}>
          {/*
            上下の余白は 12px。ロゴが 40px あるので、16px だと帯が 72px に育つ。検索欄 (32px) と
            ロゴのどちらが来ても帯が 64px に収まる値にしてある。
          */}
          {/*
            帯は 3 つの島でできている — ロゴ / 行き先 / 道具。

            **島の間は justify-between に空けさせる。** 余りを 2 等分するので、幅が
            変わっても島の切れ目が同じ割合で残る。並びの意味が読めるのは間隔の差で、
            全部を等間隔に並べると 11 個の鎖に見える (それが最初の形だった)。

            島の中の間隔は外より必ず狭くする。いまは 島間 (余りの半分) > ナビ 24px >
            道具 16px > 出ていく先 8px。この順を崩すとグループが読めなくなる。

            **幅は 6xl。** 一覧やトップの本文 (5xl) より 64px 広いが、記事ページの本文と
            目次を収める器が 6xl なので、いちばん長く見る画面ではロゴの左端と本文の左端が
            揃う。5xl に合わせると島の間が 66px まで詰まり、3 つに分けた意味が薄れる。
          */}
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
            {/*
              ロゴがホームへのリンクを兼ねる (ナビに Home を置かない)。絵はキャラクターと
              ロゴタイプを並べた一枚で、ヒーローがロゴタイプだけを大きく出すのと対になる。

              字は翻訳しない。ロゴは意匠であって文章ではないうえ、i18n の home.heading は
              英語ロケールで "yantene" になり、同じページのヒーローと食い違う。読み上げと
              リンクの名前のために、絵と同じ「やんてね」を sr-only で添える。

              色は text-foreground から取る (素材の fill が currentColor)。透過時は動く空の
              上に載るので、文字の text-halo に相当する白い縁光を filter で付ける。

              高さ 40px は、キャラクターの顔が読める最小と、14px のナビ・32px の検索欄に対して
              重くならない最大の間で取った値。素材の字間はこの大きさで見て決めてある。
            */}
            {/*
              **場所はロゴを伏せるページ (トップ) でも空けておく。** 畳むと余りの分け方が
              変わってナビが左へずれ、ページごとにナビの位置が動く。幅はロゴの絵の実寸
              (40px の高さで 128px) に合わせてある。絵を差し替えたらここも合わせること。

              高さも同じ理由で持たせる。伏せたページだけ帯が 8px 低くなり、トップと
              下層で帯の厚みが変わっていた。
            */}
            <div className="flex h-10 w-32 shrink-0 items-center">
              {showLogo && (
                <Link
                  to="/"
                  className={`press-control inline-flex items-center text-foreground${isTransparent ? " site-header-logo-halo" : ""}`}
                >
                  <Logo className="h-10 w-auto" aria-hidden="true" />
                  <span className="sr-only">やんてね</span>
                </Link>
              )}
            </div>

            {/*
              広い画面には全部を並べ、狭い画面では検索とハンバーガーだけを残して
              ドロワーへ送る (SiteMenu)。境目を lg に置いてあるのは、ナビ 4 つ・
              検索・言語・出ていく先 5 つを一列に並べると 1000px 近く要るため。

              ここが `display: none` になると島が 2 つに減り、余りは残る 2 島の間へ
              まとめて流れる (justify-between のまま帳尻が合う)。
            */}
            <SiteNav
              className={`hidden lg:block${isTransparent ? " text-halo" : ""}`}
              listClassName="flex items-center gap-6"
              linkClassName={navLinkClassName}
            />

            <div
              className={`flex shrink-0 items-center gap-3 sm:gap-4${isTransparent ? " text-halo" : ""}`}
            >
              <SearchTrigger
                onOpen={() => {
                  setSearchOpen(true);
                }}
              />

              {/*
                読み終えた後も繋がっていられる手。**帯に置くのはここだけ**で、フッターには
                置いていない (一覧の見出し脇にあるのは、その一覧に対応するフィードを指す
                別の導線)。ソーシャルメディアへの導線は帯に置かない — あれは「誰か」の
                情報で、行き先と道具を並べる場所には属さない。ヒーローと、いずれ
                プロフィール (#413) が持つ。
              */}
              <FeedIconLink className={`hidden lg:inline-flex ${iconLinkClassName}`} />

              {/*
                出し隠しは囲みの側で行う。LocaleSwitch 自身は自前の CSS で display を
                決めており (header.css)、素の CSS は Tailwind の層より後に読まれるので、
                `hidden` を直接載せても効かない。
              */}
              <div className="hidden lg:block">
                <LocaleSwitch />
              </div>

              <SiteMenu className="lg:hidden" />
            </div>
          </div>
        </div>
      </header>

      {/*
        パレットは帯の外に出す。`<dialog>` を modal で開くと最前面 (top layer) に載るので
        重なりの心配は無いが、banner のランドマークの中に検索の全体が入っていると、
        支援技術で辿ったときにヘッダーが際限なく続いて見える。
      */}
      <CommandPalette
        open={isSearchOpen}
        onClose={() => {
          setSearchOpen(false);
        }}
      />
    </>
  );
}
