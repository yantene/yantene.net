import { charsetFor, decoderFor } from "./charset";
import { readCapped } from "./read-capped";
import type {
  IWebmentionSourceFetcher,
  SourceFetchResult,
} from "~/backend/domain/webmention";
import { errorToContext, type ILogger } from "~/backend/domain/shared";
import { WebmentionUrl } from "~/backend/domain/webmention";
import { httpStatus } from "~/lib/constants/http-status";

/** 送り元を待つ時間の上限。相手が黙り込んだときにこちらの実行を道連れにしない。 */
const DEFAULT_TIMEOUT_MS = 10_000;

/**
 * 読み込む本文の上限 (バイト)。
 *
 * 超えたら打ち切って「取れなかった」ことにする。途中まで読んだ HTML を検証に回すと、
 * リンクが切れた位置より後ろにあっただけの相手を「リンクしていない」と誤判定して
 * しまうため、部分的な結果は使わない。
 */
const DEFAULT_MAX_BYTES = 1024 * 1024;

/** HTML として読むもの。それ以外は検証のしようがない。 */
const htmlContentTypes: ReadonlySet<string> = new Set([
  "text/html",
  "application/xhtml+xml",
]);

export interface HttpWebmentionSourceFetcherOptions {
  readonly timeoutMs?: number;
  readonly maxBytes?: number;
  /** fetch 実装 (テスト差し替え用)。 */
  readonly fetchFn?: typeof fetch;
}

/**
 * 送り元の記事を HTTP で取ってくる {@link IWebmentionSourceFetcher} 実装。
 *
 * 取れなかったことを throw で表さない。外部サイトが落ちている・遅い・HTML を返さない
 * のはこちらの不具合ではなく、投げ上げても直せるものが無いため (このサイトの既定は
 * fail-loud だが、ここは意図的な例外)。理由はログに残し、呼び出し側は保存を見送る。
 */
export class HttpWebmentionSourceFetcher implements IWebmentionSourceFetcher {
  private readonly timeoutMs: number;
  private readonly maxBytes: number;
  private readonly fetchFn: typeof fetch;

  constructor(
    private readonly logger: ILogger,
    options: HttpWebmentionSourceFetcherOptions = {},
  ) {
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;
    // global fetch は正しい this (globalThis) で呼ぶ必要がある。プロパティ経由の
    // メソッド呼び出しだと this が instance になり Workers が Illegal invocation を投げる。
    this.fetchFn =
      options.fetchFn ??
      ((
        input: Parameters<typeof fetch>[0],
        init?: Parameters<typeof fetch>[1],
      ) => fetch(input, init));
  }

  async fetch(source: WebmentionUrl): Promise<SourceFetchResult> {
    try {
      return await this.request(source);
    } catch (error) {
      // タイムアウト・名前解決の失敗・TLS の不一致などがここに来る。
      this.logger.info("webmention source fetch failed", {
        source: source.toString(),
        ...errorToContext(error),
      });
      return { kind: "unavailable", reason: "fetch failed" };
    }
  }

  private async request(source: WebmentionUrl): Promise<SourceFetchResult> {
    const response = await this.fetchFn(source.toString(), {
      headers: {
        accept: "text/html, application/xhtml+xml;q=0.9, */*;q=0.1",
        "user-agent": "yantene.net-webmention",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(this.timeoutMs),
      // 送り手は「いま更新した」ことを知らせに来ている。古い写しを見てはいけない。
      cache: "no-store",
    });

    if (
      response.status === httpStatus.NOT_FOUND ||
      response.status === httpStatus.GONE
    ) {
      return { kind: "gone" };
    }
    if (!response.ok) {
      return {
        kind: "unavailable",
        reason: `status ${String(response.status)}`,
      };
    }
    const contentType = response.headers.get("content-type");
    if (!isHtml(contentType)) {
      return { kind: "unavailable", reason: "not html" };
    }

    const body = response.body;
    if (body === null) return { kind: "unavailable", reason: "no body" };

    const bytes = await readCapped(body, this.maxBytes);
    if (bytes === undefined) {
      return { kind: "unavailable", reason: "body too large" };
    }
    /*
     * 中身の無い 200 を「読めた」ことにしない。
     *
     * 空を本文として通すと、リンクが見つからない = 取り消しと読まれ、**過去に受け取った
     * 返信やいいねが消える。** 送り元の一時的な不調でそれが起きるのは、`unavailable` の
     * 枝を用意した理由 (一時的な障害で過去の行を消さない) と食い違う。Webmention は
     * 正本のどこにも無いので、消したら戻せない (#293)。
     */
    if (bytes.byteLength === 0) {
      return { kind: "unavailable", reason: "empty body" };
    }
    /*
     * 読み終えてから文字コードを決める。ヘッダーが名乗らない相手は本文の `<meta>` を
     * 見るので、流しながら復号すると宣言を読む前に復号器を選ぶことになる。
     */
    const html = decoderFor(charsetFor(contentType, bytes)).decode(bytes);

    /*
     * 転送を追い切ったあとの URL を返す。相対リンクの解決基準になるので、
     * 送り手が書いた URL のままだと転送先の相対リンクが別の場所を指してしまう。
     */
    return { kind: "fetched", url: finalUrl(response, source), html };
  }
}

/** Content-Type が HTML を名乗っているか。文字コードの指定は無視する。 */
function isHtml(contentType: string | null): boolean {
  if (contentType === null) return false;
  const mediaType = contentType.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return htmlContentTypes.has(mediaType);
}

/** 転送後の URL。読めなければ送り手の書いた URL のままにする。 */
function finalUrl(response: Response, source: WebmentionUrl): WebmentionUrl {
  return WebmentionUrl.parse(response.url) ?? source;
}
