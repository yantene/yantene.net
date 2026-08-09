import { useTranslation } from "react-i18next";
import { HiMagnifyingGlass } from "react-icons/hi2";
import { Link } from "react-router";
import Logo from "~/frontend/assets/logo.svg?react";

type HeaderProps = {
  readonly variant?: "solid" | "transparent";
};

export function Header({ variant = "solid" }: HeaderProps): React.JSX.Element {
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
          : "sticky top-0 z-50 border-b border-border/50"
      }
    >
      <div className={isTransparent ? "" : "bg-white/60 backdrop-blur-sm"}>
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-6 py-4">
          {/* ロゴがホームへのリンクを兼ねる (ナビに Home を置かない)。 */}
          <Link
            to="/"
            className={`shrink-0 text-foreground${isTransparent ? " text-halo" : ""}`}
          >
            <Logo className="h-8 w-auto" />
          </Link>

          <div
            className={`flex items-center gap-5 sm:gap-7${isTransparent ? " text-halo" : ""}`}
          >
            <nav className="flex items-center gap-5 sm:gap-7">
              {/* ノート一覧が検索とタグの索引を兼ねるので、入口はここ 1 つで足りる。 */}
              <Link to="/notes" className={linkClassName}>
                Notes
              </Link>
              {/* 検索フォームを畳む幅では、探せる場所へのリンクで代替する。 */}
              <Link to="/notes" className={`${linkClassName} sm:hidden`}>
                Search
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
