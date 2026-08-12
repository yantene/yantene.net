import { useTranslation } from "react-i18next";
import { HiMagnifyingGlass } from "react-icons/hi2";
import { Link } from "react-router";
import Highlight from "~/frontend/assets/highlight.svg?react";

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

export function Header({
  variant = "solid",
  showLogo = true,
}: HeaderProps): React.JSX.Element {
  const { t } = useTranslation();
  const isTransparent = variant === "transparent";

  // 透過時は動く空の上に載る。白地前提の text-muted-foreground (62% 透過) では
  // 夜側でコントラストが 4.5:1 を割るため、濃いめの色に切り替える。
  const linkClassName = `text-sm font-medium transition-colors hover:text-primary ${
    isTransparent ? "text-foreground/80" : "text-muted-foreground"
  }`;

  return (
    <header
      className={
        isTransparent
          ? "absolute inset-x-0 top-0 z-50"
          : "site-header sticky top-0 z-50"
      }
    >
      <div className={isTransparent ? "" : "bg-white/60 backdrop-blur-sm"}>
        <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-4">
          {/*
            ロゴがホームへのリンクを兼ねる (ナビに Home を置かない)。ヒーローの見出しと
            同じ「下線付きのやんてね」を、ヘッダーの字の大きさで組む。

            字は翻訳しない。ロゴは意匠であって文章ではないうえ、i18n の home.heading は
            英語ロケールで "yantene" になり、同じページのヒーロー (ハードコードの
            「やんてね」) と食い違う。ヒーロー側に合わせてここも直に書く。
          */}
          {showLogo && (
            <Link
              to="/"
              className={`site-header-wordmark shrink-0 text-2xl font-bold leading-none tracking-tight text-foreground${isTransparent ? " text-halo" : ""}`}
            >
              <Highlight
                className="site-header-wordmark-highlight"
                aria-hidden="true"
              />
              <span className="relative">やんてね</span>
            </Link>
          )}

          {/*
            右の一群は ml-auto で押しやる。justify-between だとロゴを伏せたページ (トップ)
            で残った一群が左端へ寄ってしまい、ページごとにナビの位置が変わる。
          */}
          <div
            className={`ml-auto flex items-center gap-5 sm:gap-7${isTransparent ? " text-halo" : ""}`}
          >
            <nav className="flex items-center gap-5 sm:gap-7">
              {/*
                ノート一覧が検索とタグの索引を兼ねるので、入口はここ 1 つで足りる。
                狭い幅では字を伏せ、下の虫眼鏡に同じ入口を引き継ぐ。
              */}
              <Link to="/notes" className={`${linkClassName} hidden sm:inline`}>
                Notes
              </Link>
              {/*
                検索フォームを畳む幅の入口。行き先は上と同じ /notes で、字を並べる幅が
                無いぶんを虫眼鏡 1 つに代える (畳んだフォームの在り処を指す形にする)。
                字が無いので aria-label で名前を与える。

                負のマージンで相殺した padding は、見た目の位置を変えずにタップ領域だけを
                44px 角へ広げるためのもの。アイコンの 1.25rem だけでは指には小さすぎる。
              */}
              <Link
                to="/notes"
                aria-label={t("search.title")}
                className={`${linkClassName} -m-3 p-3 sm:hidden`}
              >
                <HiMagnifyingGlass className="size-5" aria-hidden />
              </Link>
            </nav>

            {/*
              JS 不要で動く素の GET フォーム。Enter でも虫眼鏡でも /notes に飛ぶ。
              狭い画面では場所を取りすぎるので、上の Search リンクに譲る。
            */}
            <form
              method="get"
              action="/notes"
              role="search"
              className="hidden sm:block"
            >
              {/* 透過ヘッダーでは夜の空が下に来る。地を薄くしすぎると入力文字が沈む。 */}
              <label className="input input-sm input-bordered flex items-center gap-2 rounded-full bg-base-100/90">
                <input
                  type="search"
                  name="q"
                  placeholder={t("search.placeholder")}
                  aria-label={t("search.title")}
                  autoComplete="off"
                  className="w-32 grow md:w-40"
                />
                <button
                  type="submit"
                  aria-label={t("search.title")}
                  className="text-base-content/50 transition-colors hover:text-primary"
                >
                  <HiMagnifyingGlass />
                </button>
              </label>
            </form>
          </div>
        </div>
      </div>
    </header>
  );
}
