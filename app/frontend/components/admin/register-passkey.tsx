import { useCallback, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { createPasskey, isPasskeySupported, PasskeyCancelledError } from "~/frontend/lib/passkey";
import { httpStatus } from "~/lib/constants/http-status";

/**
 * passkey を 1 本登録する。
 *
 * サインインしていないときは、登録用のトークンを添えて最初の 1 本を入れる経路になる
 * (bootstrap)。サインインしていれば端末を足す経路。**どちらを許すかを決めるのは
 * サーバー**で、ここはトークンの欄を出すかどうかしか変えない。
 */
export function RegisterPasskey({
  signedIn,
  onRegistered,
}: {
  readonly signedIn: boolean;
  readonly onRegistered: () => void;
}): React.JSX.Element {
  const { t } = useTranslation();
  const labelId = useId();
  const tokenId = useId();
  const [label, setLabel] = useState("");
  const [token, setToken] = useState("");
  const [state, setState] = useState<"idle" | "pending" | "failed" | "duplicate" | "notAllowed">(
    "idle",
  );

  const register = useCallback(() => {
    setState("pending");
    void (async () => {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token.length > 0) headers["X-Admin-Registration-Token"] = token;

      try {
        const optionsResponse = await fetch("/api/v1/admin/registration-options", {
          method: "POST",
          headers,
        });
        if (!optionsResponse.ok) {
          setState(
            optionsResponse.status === httpStatus.FORBIDDEN ||
              optionsResponse.status === httpStatus.NOT_FOUND
              ? "notAllowed"
              : "failed",
          );
          return;
        }

        const created = await createPasskey(await optionsResponse.json());
        const response = await fetch("/api/v1/admin/registration", {
          method: "POST",
          headers,
          body: JSON.stringify({ ...created, label }),
        });
        if (!response.ok) {
          setState(response.status === httpStatus.CONFLICT ? "duplicate" : "failed");
          return;
        }

        setState("idle");
        setToken("");
        setLabel("");
        onRegistered();
      } catch (error) {
        // 取りやめは何も起きなかったのと同じ。元の状態に戻す。
        setState(error instanceof PasskeyCancelledError ? "idle" : "failed");
      }
    })();
  }, [label, onRegistered, token]);

  if (!isPasskeySupported()) {
    return <p className="text-sm text-muted-foreground">{t("admin.signIn.unsupported")}</p>;
  }

  return (
    <section>
      {signedIn && (
        <h2 className="text-lg font-semibold text-foreground">{t("admin.register.title")}</h2>
      )}
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {t("admin.register.lead")}
      </p>

      <div className="mt-4 flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor={labelId} className="text-sm font-medium text-foreground">
            {t("admin.register.labelField")}
          </label>
          <input
            id={labelId}
            type="text"
            value={label}
            onChange={(event) => {
              setLabel(event.target.value);
            }}
            placeholder={t("admin.register.labelPlaceholder")}
            className="rounded border border-border bg-transparent px-3 py-2 text-sm"
          />
        </div>

        {/* トークンはサインインしていないときだけ。サインイン中は要らない。 */}
        {!signedIn && (
          <div className="flex flex-col gap-1">
            <label htmlFor={tokenId} className="text-sm font-medium text-foreground">
              {t("admin.register.tokenField")}
            </label>
            <input
              id={tokenId}
              type="password"
              autoComplete="off"
              value={token}
              onChange={(event) => {
                setToken(event.target.value);
              }}
              className="rounded border border-border bg-transparent px-3 py-2 text-sm"
            />
            <p className="text-xs text-muted-foreground">{t("admin.register.tokenHelp")}</p>
          </div>
        )}

        <div>
          <button
            type="button"
            onClick={register}
            disabled={state === "pending"}
            className="press-control rounded border border-border px-4 py-2 text-sm font-semibold transition-colors hover:text-primary disabled:opacity-50"
          >
            {t("admin.register.action")}
          </button>
        </div>

        {state === "failed" && (
          <p role="alert" className="text-sm text-error">
            {t("admin.register.failed")}
          </p>
        )}
        {state === "duplicate" && (
          <p role="alert" className="text-sm text-error">
            {t("admin.register.duplicate")}
          </p>
        )}
        {state === "notAllowed" && (
          <p role="alert" className="text-sm text-error">
            {t("admin.register.notAllowed")}
          </p>
        )}
      </div>
    </section>
  );
}
