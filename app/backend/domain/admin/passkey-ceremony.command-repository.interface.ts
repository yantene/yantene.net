import type { PasskeyCeremony, Challenge } from "./challenge.vo";

export interface IPasskeyCeremonyCommandRepository {
  /** チャレンジを預ける。寿命を過ぎたら自動で消える。 */
  issue(ceremony: PasskeyCeremony): Promise<void>;
  /**
   * 使い終わったチャレンジを捨てる。
   *
   * **検証の成否によらず捨てる。** 残すと、同じチャレンジで何度も試せる。
   */
  consume(challenge: Challenge): Promise<void>;
}
