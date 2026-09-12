import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type { AdminCredentialView } from "~/backend/handlers/admin/pages.handler";

/**
 * 登録した passkey の一覧。
 *
 * 取り消しは**最後の 1 本にはさせない**。取り消すと誰も入れなくなり、D1 を手で
 * 触るまで復帰できない (ADR 0036)。サーバー側でも同じ判定をしていて、ここは
 * その前に説明を出すためのもの。
 */
export function CredentialList({
  credentials,
  onChange,
}: {
  readonly credentials: readonly AdminCredentialView[];
  readonly onChange: () => void;
}): React.JSX.Element {
  const { t } = useTranslation();
  const [failedId, setFailedId] = useState<string | undefined>(undefined);
  const isLastOne = credentials.length <= 1;

  const revoke = useCallback(
    (id: string) => {
      setFailedId(undefined);
      void (async () => {
        const response = await fetch(`/api/v1/admin/credentials/${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        if (response.ok) {
          onChange();
          return;
        }
        setFailedId(id);
      })();
    },
    [onChange],
  );

  return (
    <section>
      <h2 className="text-lg font-semibold text-foreground">{t("admin.credentials.title")}</h2>

      {credentials.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">{t("admin.credentials.empty")}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-4">
          {credentials.map((credential) => (
            <li key={credential.id} className="border-l-2 border-border pl-4">
              <p className="text-base font-semibold text-foreground">
                {credential.label}
                {credential.current && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    ({t("admin.credentials.current")})
                  </span>
                )}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {credential.backedUp
                  ? t("admin.credentials.syncedLabel")
                  : t("admin.credentials.deviceLabel")}
                {" · "}
                {t("admin.credentials.createdAt")}: <TimeStamp iso={credential.createdAt} />
                {" · "}
                {t("admin.credentials.lastUsedAt")}:{" "}
                {credential.lastUsedAt === null ? (
                  t("admin.credentials.neverUsed")
                ) : (
                  <TimeStamp iso={credential.lastUsedAt} />
                )}
              </p>

              <button
                type="button"
                onClick={() => {
                  revoke(credential.id);
                }}
                disabled={isLastOne}
                className="press-control mt-2 rounded border border-border px-3 py-1 text-xs transition-colors hover:text-error disabled:opacity-50"
              >
                {t("admin.credentials.revoke")}
              </button>

              {isLastOne && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("admin.credentials.revokeLast")}
                </p>
              )}
              {failedId === credential.id && (
                <p role="alert" className="mt-1 text-xs text-error">
                  {t("admin.credentials.revokeFailed")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * 時刻を出す。
 *
 * `<time>` の datetime に ISO をそのまま入れ、見える形は日付までに切る。秒まで出しても
 * 使い道が無く、サーバーとブラウザで時差のぶん食い違って見える。
 */
function TimeStamp({ iso }: { readonly iso: string }): React.JSX.Element {
  return <time dateTime={iso}>{iso.slice(0, 10)}</time>;
}
