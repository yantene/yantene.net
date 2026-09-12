import { ceremonyKey, ceremonyToRecord } from "./passkey-ceremony-record";
import type {
  Challenge,
  IPasskeyCeremonyCommandRepository,
  PasskeyCeremony,
} from "~/backend/domain/admin";
import { CEREMONY_LIFETIME_SECONDS } from "~/backend/domain/admin";

export class KvPasskeyCeremonyCommandRepository implements IPasskeyCeremonyCommandRepository {
  constructor(private readonly kv: KVNamespace) {}

  async issue(ceremony: PasskeyCeremony): Promise<void> {
    await this.kv.put(
      ceremonyKey(ceremony.challenge),
      JSON.stringify(ceremonyToRecord(ceremony)),
      // 認証器に触れるまでの間だけ持てばよい。期限が来れば KV が消すので掃除は要らない。
      { expirationTtl: CEREMONY_LIFETIME_SECONDS },
    );
  }

  async consume(challenge: Challenge): Promise<void> {
    await this.kv.delete(ceremonyKey(challenge));
  }
}
