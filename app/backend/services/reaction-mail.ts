import type { EmailAddress, MailMessage } from "~/backend/domain/auth";

/**
 * リアクションの通知メールの文面。
 *
 * 宛先は書き手 (`ADMIN_EMAIL`) だけなので、日本語の 1 通りしか持たない。
 *
 * **押した人の手がかりは載せない。** セッション、UA、国のどれも。リアクションの表は
 * 「誰が押したか」を残さない作りで (ADR 0011)、通知だけがそれを外へ運ぶことはしない。
 */
export interface ReactionMailParams {
  readonly to: EmailAddress;
  /** 件名の頭に付ける字。production では空、それ以外は `[staging] ` など。 */
  readonly subjectPrefix: string;
  readonly articleTitle: string;
  readonly articleUrl: string;
  /** 付いた絵文字。 */
  readonly emoji: string;
  /** 付け替えなら前の絵文字。新しく付いたなら undefined。 */
  readonly previous: string | undefined;
  /** 付いた後の、記事のリアクションの数。 */
  readonly reactions: readonly { readonly emoji: string; readonly count: number }[];
}

/** HTML に埋める前に、字として読ませたい文字を逃がす。 */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** いまの数を 1 行にする。0 の絵文字 (外されて残った行) は載せない。 */
function summarize(reactions: ReactionMailParams["reactions"]): string {
  return reactions
    .filter((reaction) => reaction.count > 0)
    .map((reaction) => `${reaction.emoji} ${reaction.count}`)
    .join("、");
}

/**
 * 送る 1 通を組み立てる。
 *
 * 素のテキストを必ず入れる (ログインのメールと同じ理由。`sign-in-mail.ts`)。
 */
export function buildReactionMail(params: ReactionMailParams): MailMessage {
  const lead = `「${params.articleTitle}」に ${params.emoji} が付きました。`;
  const change =
    params.previous === undefined
      ? undefined
      : `${params.previous} から ${params.emoji} に付け替えられました。`;
  const counts = `いまのリアクション: ${summarize(params.reactions)}`;
  const href = escapeHtml(params.articleUrl);

  return {
    to: params.to,
    subject: `${params.subjectPrefix}「${params.articleTitle}」に ${params.emoji} が付きました`,
    text: [lead, ...(change === undefined ? [] : [change]), counts, "", params.articleUrl].join(
      "\n",
    ),
    html: [
      `<p>${escapeHtml(lead)}</p>`,
      ...(change === undefined ? [] : [`<p>${escapeHtml(change)}</p>`]),
      `<p>${escapeHtml(counts)}</p>`,
      `<p><a href="${href}">${href}</a></p>`,
    ].join("\n"),
  };
}
