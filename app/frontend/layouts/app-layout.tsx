import { useTranslation } from "react-i18next";
import { useNavigation } from "react-router";
import type { ReactNode } from "react";
import { NavigationProgress } from "~/frontend/components/navigation-progress/navigation-progress";
import { useSmoothHashScroll } from "~/frontend/lib/smooth-hash-scroll";

interface AppLayoutProps {
  readonly children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps): React.JSX.Element {
  const { t } = useTranslation();
  /*
   * 遷移中かを見るのはここ 1 箇所に留める。全ページがこのレイアウトを通るので、
   * どのリンクから始まった遷移でも同じ帯が同じ場所に出る。
   */
  const navigation = useNavigation();
  const isPending = navigation.state !== "idle";

  /*
   * ページの中を移るスクロールだけを滑らせる。目次・見出しのパーマリンク・脚注と
   * 入口が散らばっているので、全ページが通るここで 1 度だけ受ける。
   */
  useSmoothHashScroll();

  /*
   * 支援技術には aria-busy で状態だけを伝える。帯より速く終わる遷移も含めて常に正しく、
   * それ自体は読み上げを増やさない。文言として読ませるのは、帯が出るほど待たされたとき
   * だけでよい (NavigationProgress が持つ)。
   */
  return (
    <div className="flex min-h-screen flex-col bg-base-100" aria-busy={isPending}>
      <NavigationProgress isPending={isPending} label={t("navigation.loading")} />
      {children}
    </div>
  );
}
