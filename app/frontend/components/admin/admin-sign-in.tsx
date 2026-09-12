import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { RegisterPasskey } from "./register-passkey";
import { isPasskeySupported, PasskeyCancelledError, signWithPasskey } from "~/frontend/lib/passkey";

/**
 * passkey でサインインする。
 *
 * 儀式は 2 往復する。選択肢を貰い、認証器に署名させ、返す。失敗の理由はサーバーが
 * 区別しないので (ADR 0036)、画面も 1 つの文言にまとめる。
 */
export function AdminSignIn({
  onSignedIn,
}: {
  readonly onSignedIn: () => void;
}): React.JSX.Element {
  const { t } = useTranslation();
  const [state, setState] = useState<"idle" | "pending" | "failed" | "cancelled">("idle");

  const signIn = useCallback(() => {
    setState("pending");
    void (async () => {
      try {
        const optionsResponse = await fetch("/api/v1/admin/session-options", { method: "POST" });
        if (!optionsResponse.ok) throw new Error("could not start the ceremony");

        const assertion = await signWithPasskey(await optionsResponse.json());
        const response = await fetch("/api/v1/admin/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(assertion),
        });
        if (!response.ok) throw new Error("sign-in was refused");

        setState("idle");
        onSignedIn();
      } catch (error) {
        // 取りやめは落ち度ではないので、失敗として赤く出さない。
        setState(error instanceof PasskeyCancelledError ? "cancelled" : "failed");
      }
    })();
  }, [onSignedIn]);

  if (!isPasskeySupported()) {
    return <p className="mt-8 text-sm text-muted-foreground">{t("admin.signIn.unsupported")}</p>;
  }

  return (
    <div className="mt-8 flex flex-col gap-10">
      <section>
        <h2 className="text-lg font-semibold text-foreground">{t("admin.signIn.title")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t("admin.signIn.lead")}
        </p>

        <button
          type="button"
          onClick={signIn}
          disabled={state === "pending"}
          className="press-control mt-4 rounded bg-primary px-4 py-2 text-sm font-semibold text-primary-content transition-opacity disabled:opacity-50"
        >
          {state === "pending" ? t("admin.signIn.pending") : t("admin.signIn.action")}
        </button>

        {state === "failed" && (
          <p role="alert" className="mt-3 text-sm text-error">
            {t("admin.signIn.failed")}
          </p>
        )}
        {state === "cancelled" && (
          <p className="mt-3 text-sm text-muted-foreground">{t("admin.signIn.cancelled")}</p>
        )}
      </section>

      {/*
        最初の 1 本を登録するための入口。**開いているかどうかを先に知らせない。**
        「まだ鍵が無い環境かどうか」が外から分かると、トークンだけが守りになっている
        ことまで分かってしまう (ADR 0036)。押してから断られる形にする。
      */}
      <details className="rounded border border-border p-4">
        <summary className="cursor-pointer text-sm font-semibold text-foreground">
          {t("admin.register.title")}
        </summary>
        <div className="mt-4">
          <RegisterPasskey signedIn={false} onRegistered={onSignedIn} />
        </div>
      </details>
    </div>
  );
}
