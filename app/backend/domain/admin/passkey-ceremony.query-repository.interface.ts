import type { Challenge, PasskeyCeremony } from "./challenge.vo";

export interface IPasskeyCeremonyQueryRepository {
  /** 発行済みで期限内なら返す。無ければ undefined。 */
  find(challenge: Challenge): Promise<PasskeyCeremony | undefined>;
}
