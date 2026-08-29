/*
 * 共有先の URL と、クリップボードに載せる文字列の組み立て。
 *
 * 描画から切り離してあるのは、組み立ての正しさ (エスケープ・クエリの積み方) を
 * DOM 無しで確かめられるようにするため。
 */

/** 共有先 1 つぶん。アイコンは描画側が名前で引く (ここに JSX を持ち込まない)。 */
export interface ShareTarget {
  readonly key: "x" | "bluesky" | "facebook";
  readonly label: string;
  readonly href: string;
}

function blueskyQuery(url: string, title: string): string {
  return new URLSearchParams({ text: `${title} ${url}` }).toString();
}

/**
 * 各サービスの共有画面へ飛ばす URL を組み立てる。
 *
 * 公式のボタン (widget.js など) は CSP の `script-src 'self'` で読めないので使わない。
 * どのサービスも素のリンクで共有画面を開けるため、それで足りる。
 */
export function buildShareTargets(url: string, title: string): readonly ShareTarget[] {
  return [
    {
      key: "x",
      label: "X",
      href: `https://x.com/intent/post?${new URLSearchParams({ url, text: title }).toString()}`,
    },
    {
      /*
       * Bluesky の作成画面は url を別に受け取らない。本文に URL を混ぜて渡すと、
       * 投稿時にリンクカードへ展開される。
       */
      key: "bluesky",
      label: "Bluesky",
      href: `https://bsky.app/intent/compose?${blueskyQuery(url, title)}`,
    },
    {
      key: "facebook",
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?${new URLSearchParams({ u: url }).toString()}`,
    },
  ];
}

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/** Markdown のリンクテキストを壊す文字を落とす。 */
function escapeMarkdownText(text: string): string {
  return text.replaceAll(/[[\]\\]/g, (character) => `\\${character}`);
}

/**
 * クリップボードに載せる 2 つの形。
 *
 * リッチを受け付ける貼り先 (Slack / Notion / ワープロ) は html を、受け付けない貼り先は
 * plain を使う。plain を Markdown にしてあるのは、そこがだいたい自分でマークアップを書く
 * 場所 (issue・エディタ・チャット) だから。
 */
export function buildClipboardPayload(
  url: string,
  title: string,
): { readonly html: string; readonly plain: string } {
  return {
    html: `<a href="${escapeHtml(url)}">${escapeHtml(title)}</a>`,
    plain: `[${escapeMarkdownText(title)}](${url})`,
  };
}
