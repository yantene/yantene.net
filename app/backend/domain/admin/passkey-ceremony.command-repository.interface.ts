import type { Challenge, PasskeyCeremony } from "./challenge.vo";

export interface IPasskeyCeremonyCommandRepository {
  /**
   * チャレンジを預ける。
   *
   * 併せて期限切れの記録を掃除する。置き場に自動で消える仕組みが無いので、
   * 発行のついでに片付ける。
   */
  issue(ceremony: PasskeyCeremony): Promise<void>;

  /**
   * チャレンジを**取り出して消す**。無い・期限切れなら undefined。
   *
   * **引き当てと削除を 1 手で行うこと。** 読んでから消す 2 手に分けると、同じ応答を
   * 同時に 2 回送られたときに両方が通る。使い捨てであることは検証の一部なので、
   * ここは実装に原子性を求める。
   *
   * 呼ぶ側は、取り出したあとの検証に失敗しても戻さない。失敗したチャレンジを
   * 生かしておくと、同じチャレンジで何度も試せる。
   */
  consume(challenge: Challenge): Promise<PasskeyCeremony | undefined>;
}
