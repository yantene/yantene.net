import type { WebmentionUrl } from "./webmention-url.vo";

/**
 * 出さない送信元。
 *
 * 承認制ではなくブロックリストを採る。基本は出し、困った相手だけ止める。
 * 「来るかどうか分からないもの」に承認の手間を先に作らないため (#191)。
 */
export interface IWebmentionBlocklist {
  /**
   * 止めているホストを全て返す。
   *
   * 件数を絞る仕組みを持たないのは、そもそも数件を想定しているため。判定は
   * {@link isBlockedHost} が行うので、ここは並びを返すだけにする。
   */
  listBlockedHosts(): Promise<readonly string[]>;
}

/**
 * そのホストを止めているか。
 *
 * **登録したホストの下位ドメインも一緒に止める。** サブドメインを取り替えながら
 * 送ってくる相手 (`a.example.com`, `b.example.com`, …) を 1 件ずつ登録して回るのは
 * 追いつかない。`example.com` を止めれば配下も止まる。
 *
 * 判定をドメインに置いているのは、SQL の LIKE に散らすと「どこまで止まるのか」が
 * 保存の都合で決まってしまうため。
 */
export function isBlockedHost(host: string, blockedHosts: readonly string[]): boolean {
  const target = host.toLowerCase();
  return blockedHosts.some((raw) => {
    const blocked = raw.toLowerCase();
    if (blocked.length === 0) return false;
    return target === blocked || target.endsWith(`.${blocked}`);
  });
}

/** 送信元 URL が止められているか。 */
export function isBlockedSource(source: WebmentionUrl, blockedHosts: readonly string[]): boolean {
  return isBlockedHost(source.hostname, blockedHosts);
}
