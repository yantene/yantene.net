/*
 * 共有先の URL と、クリップボードに載せる文字列の組み立て。
 *
 * 描画から切り離してあるのは、組み立ての正しさ (エスケープ・クエリの積み方) を
 * DOM 無しで確かめられるようにするため。
 */

/** 共有先 1 つぶん。アイコンは描画側が名前で引く (ここに JSX を持ち込まない)。 */
export interface ShareTarget {
  readonly key: "x" | "facebook" | "bluesky" | "mastodon" | "threads" | "hatenaBookmark";
  readonly label: string;
  readonly href: string;
}

function query(params: Record<string, string>): string {
  return new URLSearchParams(params).toString();
}

/**
 * はてなブックマークの、その URL のエントリーページ。
 *
 * ブクマする手と、既に付いたコメントの両方がここにある。`add?mode=confirm` だと
 * ブクマの画面にしか行けない。https の URL は `/entry/s/` の下にスキームを落として
 * 置く (はてな自身がエントリーページをこの形で出している)。
 */
function hatenaEntryUrl(url: string): string {
  const { protocol, host, pathname, search } = new URL(url);
  const scheme = protocol === "https:" ? "s/" : "";
  return `https://b.hatena.ne.jp/entry/${scheme}${host}${pathname}${search}`;
}

/**
 * 各サービスの共有画面へ飛ばす URL を組み立てる。
 *
 * 公式のボタン (widget.js など) は CSP の `script-src 'self'` で読めないので使わない。
 * どのサービスも素のリンクで共有画面を開けるため、それで足りる。
 *
 * 並びは読み手の多い順ではなく、書き手が決めた順。印の色は描画側 (share-menu.tsx) と
 * brand-marks.css が持つ ([ADR 0052](../../../../docs/adr/0052-show-share-marks-in-each-brands-required-color.md))。
 */
export function buildShareTargets(url: string, title: string): readonly ShareTarget[] {
  return [
    {
      key: "x",
      label: "X",
      href: `https://x.com/intent/post?${query({ url, text: title })}`,
    },
    {
      // 題は渡せない。Facebook はリンク先の OGP から題と絵を読む。
      key: "facebook",
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?${query({ u: url })}`,
    },
    {
      /*
       * Bluesky の作成画面は url を別に受け取らない。本文に URL を混ぜて渡すと、
       * 投稿時にリンクカードへ展開される。
       */
      key: "bluesky",
      label: "Bluesky",
      href: `https://bsky.app/intent/compose?${query({ text: `${title} ${url}` })}`,
    },
    {
      /*
       * Mastodon は読み手ごとにサーバーが違うので、公式の中継 (share.joinmastodon.org) に
       * 任せる。初回にサーバーを聞き、2 回目からは覚えている。受け取るのは `text` だけで、
       * **クエリではなくフラグメントに置く** (公式の案内がこの形。中継のサーバーに
       * 本文が届かない)。
       */
      key: "mastodon",
      label: "Mastodon",
      href: `https://share.joinmastodon.org/#${query({ text: `${title} ${url}` })}`,
    },
    {
      key: "threads",
      label: "Threads",
      href: `https://www.threads.com/intent/post?${query({ url, text: title })}`,
    },
    {
      // 表示する名前は言語で変わるので、描画側が翻訳リソースから引く。
      key: "hatenaBookmark",
      label: "Hatena Bookmark",
      href: hatenaEntryUrl(url),
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
