/*
 * パレットが出す絵文字のデータ。
 *
 * 記事を開いただけの人に配らない。数百 KB あるので、パレットを開いた人だけが取りに行く。
 * 生成物は scripts/generate-emoji-data.mjs が作り、サーバーの許可リストと同じ元から
 * 起こしている (片方だけを直せてしまう置き方にしない)。
 */

/** 生成物の 1 件。持たせる項目を絞ってあるので鍵が短い。 */
export interface PaletteEmoji {
  /** 絵文字そのもの。 */
  readonly u: string;
  /** 表示ロケールでの名前。 */
  readonly l: string;
  /** 名前に含まれない言い回し。検索の当たりを増やすためだけに持つ。 */
  readonly t: readonly string[];
}

export interface PaletteGroup {
  readonly name: string;
  readonly emojis: readonly PaletteEmoji[];
}

/** ロケールごとの取得先。無い言語は英語に倒す。 */
function paletteUrl(locale: string): string {
  return locale.startsWith("ja")
    ? "/emoji/palette-ja.json"
    : "/emoji/palette-en.json";
}

/**
 * 取りに行った結果を覚えておく場所。開き直すたびに取りに行くと、閉じて開くだけで通信が増える。
 *
 * ただし成功した結果だけを覚える。転けた Promise を持ち続けると、通信が切れている間に
 * 一度開いただけで、そのタブでは二度と絵文字が並ばなくなる。開き直しても同じ拒否を
 * 引き当てるので、読み手がページを読み直すまで直らない。
 */
const cache = new Map<string, Promise<readonly PaletteGroup[]>>();

export function loadPalette(locale: string): Promise<readonly PaletteGroup[]> {
  const url = paletteUrl(locale);
  const cached = cache.get(url);
  if (cached !== undefined) return cached;

  const loading = fetchPalette(url);
  cache.set(url, loading);
  return loading;
}

/**
 * パレットのデータを取りに行く。転けたら覚えたものを捨ててから投げ直す。
 *
 * **捨てているのは、`loadPalette` が覚えた後のものである。** `fetch` は引数が不正でも
 * 同期的に throw せず拒否した Promise を返す (仕様で決まっている) ので、catch 節へ入るのは
 * 必ず最初の await より後、つまり `cache.set` より後になる。
 *
 * 投げ直すのは、呼び出し側 (`EmojiPalette`) が例外を受けて「読み込めなかった」を出すため。
 * ここで握り潰して空のパレットを出すと、壊れているのか絵文字が無いのか区別がつかない。
 *
 * 取り直せるのは次に開いたときからで、いま開いているパレットは救わない。閉じて開けば
 * effect が走り直して取りに行く。
 */
async function fetchPalette(url: string): Promise<readonly PaletteGroup[]> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(
        `failed to load the emoji palette: ${String(response.status)}`,
      );
    }
    return await response.json();
  } catch (error) {
    cache.delete(url);
    throw error;
  }
}

/**
 * 語で絞り込む。
 *
 * 名前とタグの両方を見る。日本語には語の区切りが無いので、前方一致ではなく含むかどうかで
 * 判ずる (「ねこ」で「くろねこ」を拾いたい)。
 */
export function filterPalette(
  groups: readonly PaletteGroup[],
  query: string,
): readonly PaletteGroup[] {
  const needle = query.trim().toLowerCase();
  if (needle === "") return groups;

  return groups
    .map((group) => ({
      name: group.name,
      emojis: group.emojis.filter((emoji) => isMatching(emoji, needle)),
    }))
    .filter((group) => group.emojis.length > 0);
}

function isMatching(emoji: PaletteEmoji, needle: string): boolean {
  if (emoji.l.toLowerCase().includes(needle)) return true;
  return emoji.t.some((tag) => tag.toLowerCase().includes(needle));
}
