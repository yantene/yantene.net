/**
 * 外部サイトを取りに行くときの共通の枷。
 *
 * 相手は自分の管理下に無いので、応答が返らないことも際限なく流れ続けることもある。
 * 時間と大きさの両方に上限を置き、超えたら諦める。
 */
import { readCapped } from "./read-capped";
import { readUntilHead } from "./read-until-head";

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

export interface CappedRequestOptions {
  readonly accept: string;
  readonly maxBytes: number;
}

/** 本文の読み方。上限まで読むか、head で打ち切るか。 */
type ReadBody = (
  body: ReadableStream<Uint8Array>,
  maxBytes: number,
) => Promise<Uint8Array | undefined>;

/**
 * 上限つきで GET する。取れなければ undefined。
 *
 * 上限を超えたときも undefined にする。途中まで読んだものを使うと、切れた HTML から
 * 中途半端なメタデータを拾ってしまう。
 */
export async function fetchCapped(
  url: string,
  options: CappedRequestOptions,
): Promise<CappedResponse | undefined> {
  return await request(url, options, readCapped);
}

/**
 * 上限つきで GET し、**`</head>` を読み終えた時点で打ち切る。**
 *
 * OGP を探すときだけ使う。材料は head にあるので、本文まで読む必要が無い。
 * `</head>` が上限までに現れなければ {@link fetchCapped} と同じ結果になる。
 */
export async function fetchCappedUntilHead(
  url: string,
  options: CappedRequestOptions,
): Promise<CappedResponse | undefined> {
  return await request(url, options, readUntilHead);
}

async function request(
  url: string,
  options: CappedRequestOptions,
  readBody: ReadBody,
): Promise<CappedResponse | undefined> {
  const response = await fetch(url, {
    headers: { accept: options.accept, "user-agent": USER_AGENT },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  if (!response.ok) return undefined;

  const body = response.body;
  if (body === null) return undefined;

  const bytes = await readBody(body, options.maxBytes);
  if (bytes === undefined) return undefined;

  return {
    bytes,
    contentType: response.headers.get("content-type") ?? "",
    url: response.url === "" ? url : response.url,
  };
}
