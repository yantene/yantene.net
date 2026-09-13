import { ADMIN_CACHE_HEADERS, currentAdmin } from "./current-admin";
import { D1AdminCredentialQueryRepository } from "~/backend/infra/d1/repositories";

/** 管理画面が描くのに要るデータ。 */
export interface AdminPageData {
  readonly signedIn: boolean;
  /** サインインしているときだけ中身が入る。 */
  readonly credentials: readonly AdminCredentialView[];
}

export interface AdminCredentialView {
  readonly id: string;
  readonly label: string;
  readonly algorithm: string;
  readonly backedUp: boolean;
  /** ISO 8601 の時刻。描くときにロケールへ直す。 */
  readonly createdAt: string;
  readonly lastUsedAt: string | null;
  /** いまのセッションが使っている鍵。取り消させないために印を付ける。 */
  readonly current: boolean;
}

/**
 * 管理画面のデータを揃える (Composition Root)。
 *
 * **サインインしていない要求には、鍵のことを何も返さない。** 何本登録されているかも
 * 返さない。返すと、まだ bootstrap が済んでいない環境かどうかを外から言い当てられる。
 */
export async function loadAdminPage(env: Env, request: Request): Promise<AdminPageData> {
  const session = await currentAdmin(env, request);
  if (session === undefined) return { signedIn: false, credentials: [] };

  const credentials = await new D1AdminCredentialQueryRepository(env.D1).list();
  return {
    signedIn: true,
    credentials: credentials.map((credential) => ({
      id: credential.id.toString(),
      label: credential.label,
      algorithm: credential.algorithm,
      backedUp: credential.backedUp,
      createdAt: credential.createdAt.toString(),
      lastUsedAt: credential.lastUsedAt?.toString() ?? null,
      current: credential.id.equals(session.credentialId),
    })),
  };
}

export { ADMIN_CACHE_HEADERS };
