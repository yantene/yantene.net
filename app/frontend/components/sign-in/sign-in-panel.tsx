import { useTranslation } from "react-i18next";

interface SignInPanelProps {
  /** その画面で伝える一文。 */
  readonly lead: string;
  /** 打ち間違いや期限切れを伝える一文。渡されたときだけ出す。 */
  readonly notice?: string;
  readonly children?: React.ReactNode;
}

/**
 * ログインまわりの 3 画面 (入力・送った・確認) の器。
 *
 * 見出しは 3 つとも "Sign in" で揃える。**同じ 1 つの出来事の途中**なので、画面ごとに
 * 別の名前を付けると、どこにいるのか分からなくなる。違うのは下の一文だけ。
 */
export function SignInPanel({ lead, notice, children }: SignInPanelProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-6 py-24">
      <h1 className="text-3xl font-bold">{t("signIn.title")}</h1>
      {notice !== undefined && (
        // 読み上げにも届かせる。打ち間違いは出し直しではなく差し替えで出る。
        <p role="alert" className="rounded-md border border-border px-3 py-2 text-sm">
          {notice}
        </p>
      )}
      <p className="text-muted-foreground">{lead}</p>
      {children}
    </div>
  );
}
