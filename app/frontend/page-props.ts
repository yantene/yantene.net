import type { SupportedLocale } from "~/lib/i18n/locale";

/**
 * すべての Inertia ページに共通で渡る props の基底。
 * locale は SSR/hydration の初期化に使われるため、各ページが利用しなくても常に渡る。
 */
export interface PageProps {
  readonly locale: SupportedLocale;
}
