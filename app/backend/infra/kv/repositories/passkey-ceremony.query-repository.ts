import { ceremonyKey, recordToPurpose } from "./passkey-ceremony-record";
import type {
  Challenge,
  IPasskeyCeremonyQueryRepository,
  PasskeyCeremony,
} from "~/backend/domain/admin";

export class KvPasskeyCeremonyQueryRepository implements IPasskeyCeremonyQueryRepository {
  constructor(private readonly kv: KVNamespace) {}

  async find(challenge: Challenge): Promise<PasskeyCeremony | undefined> {
    const value = await this.kv.get(ceremonyKey(challenge), "json");
    if (value === null) return undefined;

    const purpose = recordToPurpose(value);
    return purpose === undefined ? undefined : { challenge, purpose };
  }
}
