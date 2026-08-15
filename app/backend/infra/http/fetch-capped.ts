/**
 * 外部サイトを取りに行くときの共通の枷。
 *
 * 相手は自分の管理下に無いので、応答が返らないことも際限なく流れ続けることもある。
 * 時間と大きさの両方に上限を置き、超えたら諦める。
 */
import { readCapped } from "./read-capped";

/** 取得に使う名乗り。何が叩いているか分かるようにしておく。 */
const USER_AGENT = "yantene.net-link-card/1.0 (+https://yantene.net/)";

/** 1 リクエストの制限時間。 */
const TIMEOUT_MS = 5000;

export interface CappedResponse {
  readonly bytes: Uint8Array;
  readonly contentType: string;
  /** リダイレクトを追った後の最終 URL。相対 URL の解決に使う。 */
  readonly url: string;
}

/**
 * 上限つきで GET する。取れなければ undefined。
 *
 * 上限を超えたときも undefined にする。途中まで読んだものを使うと、切れた HTML から
 * 中途半端なメタデータを拾ってしまう。
 */
export async function fetchCapped(
  url: string,
  options: { accept: string; maxBytes: number },
): Promise<CappedResponse | undefined> {
  const response = await fetch(url, {
    headers: { accept: options.accept, "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) return undefined;

  const body = response.body;
  if (body === null) return undefined;

  const bytes = await readCapped(body, options.maxBytes);
  if (bytes === undefined) return undefined;

  return {
    bytes,
    contentType: response.headers.get("content-type") ?? "",
    url: response.url === "" ? url : response.url,
  };
}
