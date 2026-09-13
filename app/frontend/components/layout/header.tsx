import { useEffect, useState } from "react";
import { Link } from "react-router";
import { LocaleMenu } from "./locale-menu";
import { SiteMenu } from "./site-menu";
import { SiteNav } from "./site-nav";
import Logo from "~/frontend/assets/yantene-logo.svg?react";
import { FeedMenu } from "~/frontend/components/feed/feed-menu";
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
 * いて、奪うと読み手の手癖を壊す。パレット自身の入力欄で押したときも、そこで打って
 * いる人は既に検索しているので、別の検索を被せる意味が無い。
 */
function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement;
}

/*
 * ⚠️ **クラス名を `${` に直付けしないこと。**
 *
 * Tailwind は原文を字面で走査してクラスを拾う。`lg:justify-end${isTransparent` のように
 * 補間へ続けて書くと 1 つの語として読まれ、**そのクラスの CSS が生成されない**。
 * 属性には載るので DOM を見ても分からず、効かないのは使われ方がここだけの珍しい
 * クラスに限られる (`lg:block` のようによそでも使う名前は、よそのぶんで生成されて
 * 動いてしまう)。
 *
 * 実際にこれで、道具の島だけが帯の右端に寄らず升の左端に貼り付いた。必ず補間の前に
 * 空白を置くこと。
 */
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

  return (
    <>
      <header
        className={
          isTransparent
            ? "site-header-overlay fixed inset-x-0 top-0 z-50"
            : "site-header sticky top-0 z-50"
        }
      >
        {/*
          帯の地。下層は最初から敷いてあり、トップは読み出すに連れて差してくる
          (header.css の site-header-overlay-band-in)。着地する値は同じ。
        */}
        <div
          className={isTransparent ? "site-header-overlay-band" : "bg-white/60 backdrop-blur-sm"}
        >
          {/*
            上下の余白は 12px。ロゴが 40px あるので、16px だと帯が 72px に育つ。検索欄 (32px) と
            ロゴのどちらが来ても帯が 64px に収まる値にしてある。
          */}
          {/*
            帯は 3 つの島でできている — 行き先 / ロゴ / 道具。並びの意味が読めるのは
            間隔の差で、全部を等間隔に並べると 11 個の鎖に見える (それが最初の形だった)。

            **真ん中に据わるのはサイトの名前。行き先はその左、道具はその右。** 格子で
            組むのは両方の variant で同じ。余りを justify-between に分けさせていたときは、
            道具の島 (350px ほど) とロゴの場所 (128px) の差だけ真ん中の島が左へずれ、
            揃え損ねたように見えていた。

            1fr auto 1fr は、左右の升に同じだけ配る。**道具の島がどれだけ広くてもロゴは
            真ん中に残る**ので、言語や項目が増えても中心は動かない。狭くて配りきれない
            ときは、升が中身の幅まで縮んでロゴが中心から外れる (溢れて横に流れるよりは
            ずれるほうがよい)。

            際どいのは lg ちょうど。**道具の島の幅は 2 回効く** — 左の升が右の升に合わせて
            同じだけ広がるため、16px 太らせると 32px 食う。表示する言語とフィードを絵 1 つに
            畳んだので、いまは余裕がある。ナビより道具のほうが広いあいだは、ナビを増やしても
            中心は動かない。

            **トップでは真ん中が空く。** ロゴを伏せる (すぐ下のヒーローが同じ「やんてね」を
            大きく出す) ので、その軸には何も載らない。空けたままにしてあるのは、
            ヒーローのロゴタイプが同じ軸のすぐ下に続くため — 名前の居場所は 1 つで、
            帯はその上を素通りする。

            **格子を載せるのは lg から。** それより狭い画面ではナビが display: none で
            升から消えるため、ロゴが真ん中の升に落ちて右端が空く。畳んだ幅は
            justify-between のまま (ロゴが左、検索とハンバーガーが右)。

            **DOM の並びは見た目の並びに合わせる** (行き先 → ロゴ → 道具)。升を名指しして
            見た目だけ入れ替えると、キーボードの焦点が中央 → 左 → 右と飛ぶ。ホームへの手が
            帯の先頭に来ないのは惜しいが、焦点の動きが見た目と食い違うほうが害が大きい。

            島の中の間隔は外より必ず狭くする。いまは 島間 > ナビ 24px > 道具 16px >
            表示する言語 8px。この順を崩すとグループが読めなくなる。

            **幅は 6xl。** 一覧やトップの本文 (5xl) より 64px 広いが、記事ページの本文と
            目次を収める器が 6xl なので、いちばん長く見る画面ではナビの左端と本文の左端が
            揃う。5xl に合わせると島の間が 66px まで詰まり、3 つに分けた意味が薄れる。
          */}
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3 lg:grid lg:grid-cols-[1fr_auto_1fr]">
            {/*
              行き先。**左端に寄せる。** 升は 1fr に広がるが、中の `<ul>` が左から並ぶので
              そのまま左揃えになる (寄せ先を言う必要は無い)。左端は本文の左端に揃う。

              広い画面には全部を並べ、狭い画面では検索とハンバーガーだけを残して
              ドロワーへ送る (SiteMenu)。境目を lg に置いてあるのは、ナビ 4 つ・
              検索・言語・出ていく先を一列に並べると 1000px 近く要るため。

              ここが `display: none` になると島が 2 つに減り、格子も解けて
              justify-between に戻る (ロゴが左、検索とハンバーガーが右)。
            */}
            <SiteNav
              className={`hidden lg:block ${isTransparent ? "text-halo" : ""}`}
              listClassName="flex items-center gap-6"
              linkClassName={navLinkClassName}
            />

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
              **場所はロゴを伏せるページ (トップ) でも空けておく。** 幅はロゴの絵の実寸
              (40px の高さで 128px) に合わせてある。絵を差し替えたらここも合わせること。

              高さはどちらの variant でも要る。伏せたページだけ帯が 8px 低くなり、トップと
              下層で帯の厚みが変わっていた。
            */}
            <div className="flex h-10 w-32 shrink-0 items-center">
              {showLogo && (
                <Link
                  to="/"
                  className={`site-header-mark press-control inline-flex items-center text-foreground ${isTransparent ? "site-header-logo-halo" : ""}`}
                >
                  <Logo className="h-10 w-auto" aria-hidden="true" />
                  <span className="sr-only">やんてね</span>
                </Link>
              )}
            </div>

            {/*
              道具。**右端に寄せるのは、升の中で中身を寄せることで行う。**

              格子の升は 1fr に広がるので、この囲みも升いっぱいに伸びる。伸びた中で
              中身を右へ寄せれば、いちばん右の絵が帯の右端に揃う。

              `justify-self` で囲みごと寄せる手もあるが、Tailwind が出すのは
              `justify-self: flex-end` で、これは**本来 flex のための値**。格子の中では
              start / end に読み替える決まりになっているものの、読み替えない実装に当たると
              既定 (stretch) に落ちて、道具が升の左端に貼り付く — ナビは左端のまま、道具
              だけが中途半端な位置に来る、という気づきにくい壊れ方をする。

              こちらは flex の囲みに flex の値を書くだけなので、読み替えが要らない。
              畳んだ幅ではこの囲みは中身なりの幅になるので、書いてあっても何も起きない
              (右端へ送るのは親の justify-between)。
            */}
            <div
              className={`flex shrink-0 items-center gap-3 sm:gap-4 lg:justify-end ${isTransparent ? "text-halo" : ""}`}
            >
              <SearchTrigger
                onOpen={() => {
                  setSearchOpen(true);
                }}
              />

              {/*
                表示する言語。**畳んでおく。** 一度選べば cookie に 1 年残るので、帯で
                常に場所を取らせる理由が無い (LocaleMenu)。EN / JA を出したままにして
                いたときは、帯で 2 番目に目立つものが「一度決めたらほとんど触らない
                設定」になっていた。

                出し隠しは `hidden lg:block` で載せる。**器の側の display と喧嘩しない**
                ように、LocaleMenu は自前の CSS で display を決めない (header.css の
                .header-menu は position だけを持つ)。
              */}
              <LocaleMenu className="hidden lg:block" />

              {/*
                読み終えた後も繋がっていられる手。**帯に置くのはここだけ**で、フッターにも
                一覧の見出し脇にも置いていない。ソーシャルメディアへの導線は帯にもドロワー
                にも置かない — あれは「誰か」の情報で、行き先と道具を並べる場所には属さない。
                ヒーローと、いずれプロフィール (#413) が持つ。

                並びの終端に置く。出ていく先を指すものなので、ページの中を動かす道具
                (検索・表示する言語) を通り過ぎた先にあるのが素直な順になる。

                押すと種別ごとのフィードが開く (All / Articles / Notes / Slides)。
              */}
              <FeedMenu className="hidden lg:block" />

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
