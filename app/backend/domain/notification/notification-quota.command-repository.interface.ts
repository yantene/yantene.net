/**
 * 通知を 1 日に送れる数の枠。
 *
 * 送る前に枠を 1 つ取り、取れたときだけ送る。**取ってから送る**順にするのは、送信に
 * 失敗した回が枠を食わずに残ると、失敗し続ける限り何度でも送り直せてしまうため。
 */
export interface INotificationQuotaCommandRepository {
  /**
   * 枠を 1 つ取る。その日すでに `limit` 通ぶん取られていれば取れない。
   *
   * @param channel 通知の種類。種類ごとに別の枠を持つ
   * @param day UTC の日付 (`2026-11-25`)
   * @returns 取れたら true
   */
  tryTake(params: {
    readonly channel: string;
    readonly day: string;
    readonly limit: number;
  }): Promise<boolean>;
}
