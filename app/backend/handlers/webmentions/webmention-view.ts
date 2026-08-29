import type { Webmention, WebmentionTypeName } from "~/backend/domain/webmention";

/**
 * 画面に出す 1 通ぶん。
 *
 * 著者名・本文は保存の時点で HTML を落としたテキストになっているので、描く側は
 * 素の文字列として扱ってよい。アイコンは写しの配信 URL を指す (写せていなければ null)。
 */
export interface WebmentionView {
  readonly id: string;
  readonly type: WebmentionTypeName;
  readonly source: string;
  readonly authorName: string | null;
  readonly authorUrl: string | null;
  readonly authorAvatarUrl: string | null;
  readonly content: string | null;
  /** 送り元の記事の公開日時 (ISO 8601)。読めていなければ受け取った時刻で代える。 */
  readonly publishedAt: string;
}

export function toWebmentionView(webmention: Webmention): WebmentionView {
  const avatar = webmention.authorAvatar;
  return {
    id: webmention.id,
    type: webmention.type.toJSON(),
    source: webmention.source.toString(),
    authorName: webmention.author.name ?? null,
    authorUrl: webmention.author.url?.toString() ?? null,
    authorAvatarUrl: avatar === undefined ? null : `/api/v1/webmentions/avatars/${avatar}`,
    content: webmention.content?.toString() ?? null,
    // 相手が公開日時を書いていないことは珍しくない。並べる軸を欠かさないよう受信時刻で代える。
    publishedAt: (webmention.publishedAt ?? webmention.receivedAt).toString(),
  };
}

/** 出し方の違う 2 つに分ける。顔だけ並べるものと、本文を読ませるもの。 */
export interface WebmentionGroups {
  /** いいね・リポスト。顔だけを並べる。 */
  readonly faces: readonly WebmentionView[];
  /** 返信・言及。本文の抜粋と出典を出す。 */
  readonly replies: readonly WebmentionView[];
}

const faceTypes: ReadonlySet<WebmentionTypeName> = new Set(["like", "repost"]);

export function toWebmentionGroups(webmentions: readonly Webmention[]): WebmentionGroups {
  const views = webmentions.map((webmention) => toWebmentionView(webmention));
  return {
    faces: views.filter((view) => faceTypes.has(view.type)),
    replies: views.filter((view) => !faceTypes.has(view.type)),
  };
}
