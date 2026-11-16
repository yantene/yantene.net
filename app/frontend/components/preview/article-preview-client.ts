import type { ArticlePreview } from "~/backend/handlers/articles/preview.handler";

/** プレビューを取りに行く口。テストで差し替えられるよう、fetch の形だけを受ける。 */
export type PreviewFetcher = (input: string) => Promise<Response>;

/**
 * 記事のプレビューを取りに行き、ページの中で覚えておく。
 *
 * **同じ記事には 2 回取りに行かない。** 覚えるのは結果ではなく約束 (Promise) のほうで、
 * 応答を待っている間にもう一度ホバーされても、飛ぶ要求は 1 本で済む。
 *
 * 「見えない記事」(404) も `null` として覚える。下書きへのリンクにホバーするたびに
 * 404 を取り直しても、答えは変わらない。
 *
 * **通信の失敗は覚えない。** 一度つながらなかっただけで、そのページを開いている間
 * ずっとチップが出なくなるのは、読み手の側からは直しようがない。次のホバーで取り直す。
 */
export class ArticlePreviewClient {
  readonly #fetcher: PreviewFetcher;
  readonly #known = new Map<string, Promise<ArticlePreview | null>>();

  constructor(fetcher: PreviewFetcher) {
    this.#fetcher = fetcher;
  }

  load(slug: string): Promise<ArticlePreview | null> {
    const known = this.#known.get(slug);
    if (known !== undefined) return known;

    const loading = this.#request(slug).catch(() => {
      this.#known.delete(slug);
      return null;
    });
    this.#known.set(slug, loading);
    return loading;
  }

  async #request(slug: string): Promise<ArticlePreview | null> {
    const response = await this.#fetcher(`/api/v1/articles/${encodeURIComponent(slug)}/preview`);
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`preview request failed: ${String(response.status)}`);
    return response.json<ArticlePreview>();
  }
}

/**
 * ページの中で 1 つだけ持つ口。
 *
 * モジュールスコープに置くのは、本文が組み直されても (MdastRenderer が描き直されても)
 * 覚えたものを失わないため。**サーバーでは呼ばれない** (呼ぶのはホバーのハンドラだけ)
 * ので、リクエストをまたいで読み手の間で共有されることは無い。fetch を包むのは、
 * 読み込み時ではなく呼ばれたときの `fetch` を引くため。
 */
export const articlePreviews = new ArticlePreviewClient((input) => fetch(input));
