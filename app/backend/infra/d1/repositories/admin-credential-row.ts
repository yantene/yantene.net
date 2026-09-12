import { instantToUnix, unixToInstant } from "~/backend/infra/d1/temporal";
import type { CredentialAlgorithm } from "~/backend/domain/admin";
import { AdminCredential, CredentialId } from "~/backend/domain/admin";

/** D1 の 1 行。 */
export interface AdminCredentialRow {
  readonly id: string;
  readonly publicKey: string;
  readonly algorithm: string;
  readonly signCount: number;
  readonly label: string;
  readonly backedUp: boolean;
  readonly createdAt: number;
  readonly lastUsedAt: number | null;
}

export function rowToCredential(row: AdminCredentialRow): AdminCredential {
  return AdminCredential.reconstruct({
    id: CredentialId.create(row.id),
    publicKey: row.publicKey,
    algorithm: toAlgorithm(row.algorithm),
    signCount: row.signCount,
    label: row.label,
    backedUp: row.backedUp,
    createdAt: unixToInstant(row.createdAt),
    lastUsedAt: row.lastUsedAt === null ? undefined : unixToInstant(row.lastUsedAt),
  });
}

export function credentialToRow(credential: AdminCredential): AdminCredentialRow {
  return {
    id: credential.id.toString(),
    publicKey: credential.publicKey,
    algorithm: credential.algorithm,
    signCount: credential.signCount,
    label: credential.label,
    backedUp: credential.backedUp,
    createdAt: instantToUnix(credential.createdAt),
    lastUsedAt: credential.lastUsedAt === undefined ? null : instantToUnix(credential.lastUsedAt),
  };
}

/**
 * 列に入っている算法の名前を読む。
 *
 * 知らない値なら送出する。既定に倒すと、読めない鍵を「ES256 の鍵」として扱って
 * 検証に進み、落ちた理由が分からなくなる (fail-loud)。
 */
function toAlgorithm(value: string): CredentialAlgorithm {
  if (value === "ES256" || value === "RS256") return value;
  throw new TypeError(`admin_credentials.algorithm has an unknown value: ${JSON.stringify(value)}`);
}
