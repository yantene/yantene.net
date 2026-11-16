/**
 * 反応や閲覧数を持てるコンテンツの種別。
 *
 * いま在るのは記事だけ。種別を足したら、人気順の候補を出す部分クエリ (infra 側) にも
 * 足すこと。足さなければ、その種別は順位に出てこない。
 */
export const contentKinds = ["article"] as const;

export type ContentKind = (typeof contentKinds)[number];

/** 文字列が種別として読めるか。 */
export function isContentKind(value: string): value is ContentKind {
  return (contentKinds as readonly string[]).includes(value);
}

/**
 * 種別をまたいでコンテンツ 1 つを指す。
 *
 * id は種別ごとの表で振られるので、id だけでは何を指すかが決まらない。必ず種別と対で運ぶ。
 */
export interface ContentRef {
  readonly kind: ContentKind;
  readonly id: string;
}

/** 記事 1 本を指す。 */
export function articleRef(id: string): ContentRef {
  return { kind: "article", id };
}
