import { AdminAuthService } from "~/backend/services/admin-auth.service";
import { RegistrationClosedError } from "~/backend/domain/admin";
import {
  D1AdminCredentialCommandRepository,
  D1AdminCredentialQueryRepository,
} from "~/backend/infra/d1/repositories";
import {
  KvAdminSessionCommandRepository,
  KvAdminSessionQueryRepository,
  KvPasskeyCeremonyCommandRepository,
  KvPasskeyCeremonyQueryRepository,
} from "~/backend/infra/kv/repositories";
import { WebCryptoPasskeyVerifier } from "~/backend/infra/webauthn/web-crypto-passkey-verifier";

/**
 * Composition Root: env から管理者認証のサービスを組み立てる。
 *
 * 資格情報は D1、セッションとチャレンジは KV、検証は Web Crypto (ADR 0036)。
 */
export function resolveAdminAuthService(env: Env): AdminAuthService {
  return new AdminAuthService({
    credentialQuery: new D1AdminCredentialQueryRepository(env.D1),
    credentialCommand: new D1AdminCredentialCommandRepository(env.D1),
    sessionQuery: new KvAdminSessionQueryRepository(env.SESSIONS),
    sessionCommand: new KvAdminSessionCommandRepository(env.SESSIONS),
    ceremonyQuery: new KvPasskeyCeremonyQueryRepository(env.SESSIONS),
    ceremonyCommand: new KvPasskeyCeremonyCommandRepository(env.SESSIONS),
    verifier: new WebCryptoPasskeyVerifier(),
  });
}

/**
 * cookie に `Secure` を付けるか。
 *
 * development 以外では必ず付ける。**想定外の `APP_ENV` も付ける側に倒す**
 * (secure by default)。CSP の判断 (ADR 0007) と同じ形。
 */
export function shouldUseSecureCookie(env: Env): boolean {
  return env.APP_ENV !== "development";
}

/**
 * 登録用の secret を読む。
 *
 * 無ければ登録の経路そのものを閉じる (fail-loud)。「secret があれば守る・無ければ
 * 素通し」にすると、置き忘れた環境で誰でも管理者になれる。
 */
export function readRegistrationToken(env: Env): string {
  const value = (env as unknown as Record<string, unknown>).ADMIN_REGISTRATION_TOKEN;
  if (typeof value !== "string" || value.length === 0) {
    throw new RegistrationClosedError(
      "ADMIN_REGISTRATION_TOKEN is not set; registration is closed",
    );
  }
  return value;
}
