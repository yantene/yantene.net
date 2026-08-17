import type { Temporal } from "@js-temporal/polyfill";
import type {
  ILinkCardAssetCache,
  ILinkCardCommandRepository,
  ILinkCardFetcher,
  ILinkCardQueryRepository,
} from "~/backend/domain/link-card";
import type { ILogger } from "~/backend/domain/shared";
import {
  LinkCard,
  LinkCardUrl,
  linkCardIdFor,
  staleCutoffs,
} from "~/backend/domain/link-card";

/**
 * 1 回の refresh で取りに行くカードの上限。
 *
 * カード 1 枚につき最大 3 リクエスト (HTML・OG 画像・favicon) 出るので、
 * Workers のサブリクエスト上限に対して余裕を持たせる。溢れた分は次回に回る
 * (期限切れのものは古い順に選ぶので、放置され続けることはない)。
 */
const MAX_CARDS_PER_RUN = 40;

/** 同時に取りに行く数。相手にも自分にも優しい程度に抑える。 */
const CONCURRENCY = 4;

/** 期限切れを拾う件数。上限より多めに見て、新しく貼られた分と合わせて上限で切る。 */
const STALE_SCAN_LIMIT = MAX_CARDS_PER_RUN;

export interface LinkCardsSyncResult {
  /** カードにできた URL。 */
  readonly fetched: string[];
  /**
   * 取りに行けなかったが、前回の中身で持ちこたえた URL。
   *
   * **記事の見た目は変わっていない** (カードのまま古い中身が出ている)。素のリンクへ
   * 落ちた `failed` と分けて出す。混ぜると、運用者が「見た目が壊れた」のか「古いまま
   * 出ている」のかを見分けられない。
   */
  readonly kept: string[];
  /** 取りに行ってカードにできなかった URL。素のリンクとして描かれる。 */
  readonly failed: string[];
  /** 上限に掛かって今回は見送った件数。黙って切り捨てない。 */
  readonly deferred: number;
}

/** 1 枚を取り直した結果。`kept` は見た目が変わっていないことを表す。 */
type SyncOutcome = "fetched" | "kept" | "failed";

/**
 * 本文に貼られた URL のカードを揃えるサービス。
 *
 * refresh の変更検出は Markdown とアセットのハッシュなので、記事が変わらない限りカードは
 * 取り直されない。そこで 2 つの入口を合わせて 1 回で処理する。
 *
 * 1. 今回処理した記事が参照している URL — 新しく貼られたリンクを拾う
 * 2. 期限切れの既存カード — 記事が変わらなくてもリンク先の変化に追随する
 *
 * 2 を記事ではなくカードの表から引くのがこの設計の要で、そのおかげで変更のなかった記事の
 * MDAST を読み直さずに済む。
 */
export class LinkCardsRefreshService {
  constructor(
    private readonly fetcher: ILinkCardFetcher,
    private readonly command: ILinkCardCommandRepository,
    private readonly query: ILinkCardQueryRepository,
    private readonly assets: ILinkCardAssetCache,
    private readonly logger: ILogger,
  ) {}

  async sync(
    referencedUrls: readonly string[],
    now: Temporal.Instant,
    options: { readonly force?: boolean } = {},
  ): Promise<LinkCardsSyncResult> {
    const referenced = toLinkCardUrls(referencedUrls);
    const existing = await this.query.findByUrls(referenced);
    const known = new Map(
      existing.map((card) => [card.url.toString(), card] as const),
    );

    // 未取得・期限切れ・force のものだけ取りに行く。
    const fresh = referenced.filter((url) => {
      const card = known.get(url.toString());
      return options.force === true || card === undefined || card.isStale(now);
    });

    const stale = await this.query.listStale({
      ...staleCutoffs(now),
      limit: STALE_SCAN_LIMIT,
    });

    // 取りに行く前の行。失敗したときに何を持ちこたえるかを決めるのに使う。ここまでで
    // 2 回引いてあるので、1 枚ごとに引き直さない (障害時は planned 全件が失敗するため、
    // 引き直すと同じ行を最大 40 回取りに行くことになる)。
    const previous = new Map<string, LinkCard>([
      ...known,
      ...stale.map((card) => [card.url.toString(), card] as const),
    ]);

    const targets = dedupe([...fresh, ...stale.map((card) => card.url)]);
    const planned = targets.slice(0, MAX_CARDS_PER_RUN);
    const deferred = targets.length - planned.length;
    if (deferred > 0) {
      this.logger.info("link card sync deferred some targets", {
        planned: planned.length,
        deferred,
      });
    }

    const results = await mapWithConcurrency(
      planned,
      CONCURRENCY,
      async (url) => ({
        url: url.toString(),
        outcome: await this.syncOne(url, now, previous.get(url.toString())),
      }),
    );

    const urlsWhere = (outcome: SyncOutcome): string[] =>
      results.filter((r) => r.outcome === outcome).map((r) => r.url);

    return {
      fetched: urlsWhere("fetched"),
      kept: urlsWhere("kept"),
      failed: urlsWhere("failed"),
      deferred,
    };
  }

  /**
   * 取れなかったときの行を書く。持ちこたえたかどうかを返す。
   *
   * 持ちこたえるか諦めるかを決めるのはエンティティ ({@link LinkCard.afterFailedFetch})。
   * ここは決まったことを R2 に反映するだけにする。
   */
  private async recordFailure(
    id: string,
    url: LinkCardUrl,
    previous: LinkCard | undefined,
    now: Temporal.Instant,
  ): Promise<SyncOutcome> {
    const card = LinkCard.afterFailedFetch({ id, url, previous, now });
    await this.command.upsert(card);

    if (card.isAvailable) {
      // 持ちこたえる間は写しにも触れない。題と説明だけ残して絵を消すと、相手が一瞬
      // 落ちただけでカードの形が変わる。中身が古いことに変わりはないので、揃えて残す。
      return "kept";
    }

    // 諦めた。素のリンクに落ちるので、絵と favicon の写しはもう誰も参照しない。
    // 残すと R2 に読まれない実体が積もる。
    await this.assets.deleteAssets(id);
    return "failed";
  }

  /**
   * カード 1 枚を取り直す。
   *
   * 取れなかったときも行は書く。行を作らずにおくと、落ちている相手を refresh のたびに
   * 叩き直すことになる。失敗を期限付きで覚えておけば、次にいつ試すかをこちらで決められる。
   *
   * @param previous 取りに行く前の行。初めて取りに行く URL では undefined。
   */
  private async syncOne(
    url: LinkCardUrl,
    now: Temporal.Instant,
    previous: LinkCard | undefined,
  ): Promise<SyncOutcome> {
    const id = await linkCardIdFor(url);
    const fetched = await this.fetcher.fetch(url);

    if (fetched === undefined) {
      return await this.recordFailure(id, url, previous, now);
    }

    // 前回の写しを捨てる。今回 og:image が消えていた場合に、古い絵が残り続けない。
    await this.assets.deleteAssets(id);

    if (fetched.image.state === "stored") {
      await this.assets.putImage(id, fetched.image.asset);
    }
    if (fetched.favicon !== undefined) {
      await this.assets.putFavicon(id, fetched.favicon);
    }

    await this.command.upsert(
      LinkCard.available({
        id,
        url,
        metadata: {
          title: fetched.title,
          description: fetched.description,
          siteName: fetched.siteName,
          // 絵を取り逃したことはここまで運ぶ。カード自体は取れているので、期限を
          // 分けておかないと絵の欠けたまま 14 日直らない。
          image: fetched.image.state,
          hasFavicon: fetched.favicon !== undefined,
        },
        fetchedAt: now,
      }),
    );
    return "fetched";
  }
}

/** 文字列を VO に通す。カードにできない URL は落とす (本文由来なので普通は起きない)。 */
function toLinkCardUrls(raw: readonly string[]): readonly LinkCardUrl[] {
  const urls: LinkCardUrl[] = [];
  for (const value of raw) {
    try {
      urls.push(LinkCardUrl.create(value));
    } catch {
      continue;
    }
  }
  return urls;
}

function dedupe(urls: readonly LinkCardUrl[]): readonly LinkCardUrl[] {
  const seen = new Set<string>();
  return urls.filter((url) => {
    const key = url.toString();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** 同時実行数を抑えて写す。入力の並び順どおりに結果を返す。 */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let start = 0; start < items.length; start += limit) {
    const batch = items.slice(start, start + limit);
    results.push(...(await Promise.all(batch.map((item) => task(item)))));
  }
  return results;
}
