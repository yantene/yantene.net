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
 * Temporal.Instant は暦を持たないので日単位の加算ができない。時間で持つ。
 */
const AVAILABLE_TTL_HOURS = 24 * 14;
const UNAVAILABLE_TTL_HOURS = 24;

/** 取得できたカードの中身。画像は R2 にあるので、ここでは有無だけを持つ。 */
export interface LinkCardMetadata {
  readonly title: string;
  readonly description: string | undefined;
  readonly siteName: string | undefined;
  readonly hasImage: boolean;
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
    return new LinkCard(params);
  }

  /** 取得できなかったカード。素のリンクとして描かれる。 */
  static unavailable(params: {
    id: string;
    url: LinkCardUrl;
    fetchedAt: Temporal.Instant;
  }): LinkCard {
    return new LinkCard({ ...params, metadata: undefined });
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

  get isAvailable(): boolean {
    return this.fields.metadata !== undefined;
  }

  /** 取り直すべき頃合いか。 */
  isStale(now: Temporal.Instant): boolean {
    return Temporal.Instant.compare(now, this.staleAt()) >= 0;
  }

  private staleAt(): Temporal.Instant {
    const hours = this.isAvailable
      ? AVAILABLE_TTL_HOURS
      : UNAVAILABLE_TTL_HOURS;
    return this.fields.fetchedAt.add({ hours });
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
} {
  return {
    available: now.subtract({ hours: AVAILABLE_TTL_HOURS }),
    unavailable: now.subtract({ hours: UNAVAILABLE_TTL_HOURS }),
  };
}
