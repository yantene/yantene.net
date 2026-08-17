import { Temporal } from "@js-temporal/polyfill";
import type { LinkCardUrl } from "./link-card-url.vo";

/*
 * カードを取り直すまでの間隔。
 *
 * refresh の変更検出は Markdown とアセットのハッシュで行うので、記事が変わらない限り
 * カードも取り直されない。リンク先のタイトルが変わっても古いまま出続けるため、カード
 * 自身に期限を持たせ、期限切れのものだけを refresh のついでに洗い替える。
 *
 * 取れなかったものを短くしているのは、相手が一時的に落ちていただけのときに早く復帰
 * させたいため。逆に取れているものを長めにするのは、リンク先の見出しがそう頻繁に
 * 変わらないのと、refresh のたびに外部を叩き直す量を抑えたいため。
 *
 * 絵だけ取り逃したカードを取れなかったものと同じ間隔にしているのは、取り逃しの多くが
 * レート制限のような一時的なものだから。題が取れていれば「取得できた」として 14 日
 * 待つことになり、絵が欠けたまま直らなかった (#255)。
 *
 * 前回の中身を持ちこたえているカードも短い側にする。見せているのは古い中身なので、
 * 早く確かめ直したい。
 *
 * Temporal.Instant は暦を持たないので日単位の加算ができない。時間で持つ。
 */
const AVAILABLE_TTL_HOURS = 24 * 14;
const UNAVAILABLE_TTL_HOURS = 24;
const IMAGE_MISSED_TTL_HOURS = 24;
const KEPT_AFTER_FAILURE_TTL_HOURS = 24;

/**
 * 取得に失敗し続けているカードが、前回の中身を持ちこたえる上限。
 *
 * **失敗し始めてからこの時間が経ってもなお失敗したら、中身を捨てて素のリンクに落とす**
 * (ADR 0014 の既定へ戻る)。上限を置かないと、恒久的に死んだリンクが古い題と絵を永久に
 * 出し続け、force refresh でも消せなくなる。
 *
 * 相手の不調が 3 日続くなら、それはもう「一時的」ではない。
 *
 * **壁時計の保証ではない。** refresh は cron ではなくコンテンツの push で走るので、
 * 判定されるのは「この幅を越えてから、次に取りに行って失敗したとき」でしかない。
 * したがって諦めるまでの試行は**多くとも 3 回** (24 時間の刻みで来続けたとき) で、
 * 下限は 1 回。push が 4 日来なければ、次の 1 回で諦める。
 */
const KEEP_AFTER_FAILURE_WINDOW_HOURS = 24 * 3;

/**
 * カードの絵をどうしたか。画像の実体は R2 にあるので、ここでは状態だけを持つ。
 *
 * - `stored`: 写した。自分のところから配れる
 * - `absent`: 載せる絵が無い。相手が出していないか、載せられない型だった
 * - `missed`: 絵はあるはずなのに写せなかった。次は取れるかもしれない
 *
 * `absent` と `missed` を分けるのは、取り直す価値があるのが `missed` だけだから。
 * 一緒くたにすると、絵を持たない相手まで短い間隔で叩き直すことになる。
 */
export type LinkCardImageState = "stored" | "absent" | "missed";

/** 取得できたカードの中身。 */
export interface LinkCardMetadata {
  readonly title: string;
  readonly description: string | undefined;
  readonly siteName: string | undefined;
  readonly image: LinkCardImageState;
  readonly hasFavicon: boolean;
}

/**
 * 本文に貼られた URL 1 つぶんのカード。記事ではなく URL に紐づく。
 *
 * 同じリンクを複数の記事から張っても取得は 1 回で済ませたいので、記事との関連は
 * 持たせない。どの記事に出るかは、その記事の MDAST を見れば分かる。
 *
 * **取得できなかったことも 1 つの状態として持つ** (metadata が undefined)。行を作らずに
 * おくと、落ちている相手を refresh のたびに叩き直すことになる。取得の成否を期限付きで
 * 覚えておけば、次にいつ試すかをこちらで決められる。
 */
export class LinkCard {
  private constructor(
    private readonly fields: {
      readonly id: string;
      readonly url: LinkCardUrl;
      readonly metadata: LinkCardMetadata | undefined;
      /**
       * 続いている失敗が始まった時刻。直近の取得が成功していれば undefined。
       *
       * **中身を持ちこたえているカードだけが持つ。** 中身の無いカード (unavailable) は
       * 持ちこたえるものが無いので、常に undefined になる。この対応のおかげで
       * 「metadata の有無」と「この値の有無」の組が 3 通りの状態に 1 対 1 で対応する。
       */
      readonly fetchFailedSince: Temporal.Instant | undefined;
      readonly fetchedAt: Temporal.Instant;
    },
  ) {}

  /** 取得できたカード。 */
  static available(params: {
    id: string;
    url: LinkCardUrl;
    metadata: LinkCardMetadata;
    fetchedAt: Temporal.Instant;
  }): LinkCard {
    return new LinkCard({ ...params, fetchFailedSince: undefined });
  }

  /**
   * 取得できなかったが、前回の中身を持ちこたえているカード。
   *
   * 見せるものは前回のまま。取り直しは「取得できなかった」側の短い間隔に倒す。
   * 直接呼ぶのは行を復元するときだけで、失敗したときの生成は {@link afterFailedFetch}
   * を通す (持ちこたえるかどうかの判断をドメインの外に出さないため)。
   */
  static keptAfterFailure(params: {
    id: string;
    url: LinkCardUrl;
    metadata: LinkCardMetadata;
    fetchFailedSince: Temporal.Instant;
    fetchedAt: Temporal.Instant;
  }): LinkCard {
    return new LinkCard(params);
  }

  /** 取得できなかったカード。素のリンクとして描かれる。 */
  static unavailable(params: {
    id: string;
    url: LinkCardUrl;
    fetchedAt: Temporal.Instant;
  }): LinkCard {
    return new LinkCard({
      ...params,
      metadata: undefined,
      fetchFailedSince: undefined,
    });
  }

  /**
   * 取りに行って失敗したときのカードを決める。
   *
   * **前回の中身があれば、しばらくは持ちこたえる。** 中身ごと捨てると、相手が一瞬落ちた
   * だけで記事のカードが素のリンクへ落ち、次の refresh まで戻らない。refresh はコンテンツ
   * の push で走るので、「次」が来るのは何日も先のことがある (#323)。
   *
   * **持ちこたえるのは {@link KEEP_AFTER_FAILURE_WINDOW_HOURS} まで。** それを越えても
   * なお取れないなら中身を捨てて素のリンクに落とす。上限が無いと、恒久的に死んだリンクが
   * 古い中身を永久に出し続ける。判断の経緯は ADR 0026 を参照。
   *
   * @param previous 同じ URL の前回の行。初めて取りに行くときは undefined。
   */
  static afterFailedFetch(params: {
    id: string;
    url: LinkCardUrl;
    previous: LinkCard | undefined;
    now: Temporal.Instant;
  }): LinkCard {
    const { id, url, previous, now } = params;
    const metadata = previous?.metadata;
    if (metadata === undefined) {
      return this.unavailable({ id, url, fetchedAt: now });
    }

    // 前回も失敗していたなら、その起点を引き継ぐ。成功していたなら今回が起点。
    const since = previous?.fetchFailedSince ?? now;
    const givesUpAt = since.add({ hours: KEEP_AFTER_FAILURE_WINDOW_HOURS });
    if (Temporal.Instant.compare(now, givesUpAt) >= 0) {
      return this.unavailable({ id, url, fetchedAt: now });
    }

    return this.keptAfterFailure({
      id,
      url,
      metadata,
      fetchFailedSince: since,
      fetchedAt: now,
    });
  }

  get id(): string {
    return this.fields.id;
  }

  get url(): LinkCardUrl {
    return this.fields.url;
  }

  /** 取得できていなければ undefined。 */
  get metadata(): LinkCardMetadata | undefined {
    return this.fields.metadata;
  }

  get fetchedAt(): Temporal.Instant {
    return this.fields.fetchedAt;
  }

  /** 見せるものがあるか。直近の取得が失敗していても、前回の中身があれば true。 */
  get isAvailable(): boolean {
    return this.fields.metadata !== undefined;
  }

  /**
   * 続いている失敗の起点。直近の取得が成功していれば undefined。
   *
   * 持ちこたえる上限を測る基準で、失敗が続く間は書き換えない (`fetchedAt` のほうは
   * 試すたびに進む)。両方を進めてしまうと上限にいつまでも届かない。
   */
  get fetchFailedSince(): Temporal.Instant | undefined {
    return this.fields.fetchFailedSince;
  }

  /** 取り直すべき頃合いか。 */
  isStale(now: Temporal.Instant): boolean {
    return Temporal.Instant.compare(now, this.staleAt()) >= 0;
  }

  private staleAt(): Temporal.Instant {
    return this.fields.fetchedAt.add({ hours: this.ttlHours() });
  }

  private ttlHours(): number {
    const metadata = this.fields.metadata;
    if (metadata === undefined) return UNAVAILABLE_TTL_HOURS;
    // 中身が残っていても、直近が失敗なら短い間隔で試す。見せているのは古い中身なので。
    if (this.fields.fetchFailedSince !== undefined) {
      return KEPT_AFTER_FAILURE_TTL_HOURS;
    }
    return metadata.image === "missed"
      ? IMAGE_MISSED_TTL_HOURS
      : AVAILABLE_TTL_HOURS;
  }
}

/**
 * 「この時刻より前に取ったものは古い」の境目。期限切れの行を SQL で絞るために使う。
 *
 * 期限そのものはドメインの決めごとなので、リポジトリに定数を持たせず境目を渡す。
 */
export function staleCutoffs(now: Temporal.Instant): {
  readonly available: Temporal.Instant;
  readonly unavailable: Temporal.Instant;
  readonly imageMissed: Temporal.Instant;
  readonly keptAfterFailure: Temporal.Instant;
} {
  return {
    available: now.subtract({ hours: AVAILABLE_TTL_HOURS }),
    unavailable: now.subtract({ hours: UNAVAILABLE_TTL_HOURS }),
    imageMissed: now.subtract({ hours: IMAGE_MISSED_TTL_HOURS }),
    // いまの値は取れなかったカードと同じだが、別の項目として渡す。同じだからと
    // 使い回すと、片方だけ変えたときに SQL とエンティティが黙って食い違う。
    keptAfterFailure: now.subtract({ hours: KEPT_AFTER_FAILURE_TTL_HOURS }),
  };
}
