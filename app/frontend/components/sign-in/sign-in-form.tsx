import { useTranslation } from "react-i18next";
import { SignInPanel } from "./sign-in-panel";
import { signInEmailField, signInPath } from "~/lib/constants/sign-in";

interface SignInFormProps {
  /** 打ち間違いを弾いて戻ってきたか。 */
  readonly invalid: boolean;
}

/**
 * メールアドレスを打つ画面。
 *
 * **素の `<form method="post">`。** JavaScript が動かなくても送れる。受け口は
 * Hono 側 (`POST /sign-in`) で、送っても送らなくても同じ場所へ返す (ADR 0039)。
 */
export function SignInForm({ invalid }: SignInFormProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <SignInPanel lead={t("signIn.lead")} notice={invalid ? t("signIn.invalid") : undefined}>
      <form method="post" action={signInPath} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-bold">
          {t("signIn.emailLabel")}
          <input
            type="email"
            name={signInEmailField}
            required
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            className="rounded-md border border-border bg-transparent px-3 py-2 text-base font-normal"
          />
        </label>
        <button
          type="submit"
          className="press-control rounded-md border border-border px-3 py-2 font-bold"
        >
          {t("signIn.submit")}
        </button>
      </form>
    </SignInPanel>
  );
}
