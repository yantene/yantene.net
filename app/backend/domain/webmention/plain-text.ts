/** 連続する空白 (改行を含む) をひとまとめにするための並び。 */
const whitespacePattern = /\s+/g;

/** 素通ししたくない基本的な文字実体参照。 */
const entities: ReadonlyMap<string, string> = new Map([
  ["&amp;", "&"],
  ["&lt;", "<"],
  ["&gt;", ">"],
  ["&quot;", '"'],
  ["&#39;", "'"],
  ["&apos;", "'"],
  ["&nbsp;", " "],
]);

const entityPattern = /&(?:amp|lt|gt|quot|apos|nbsp|#39);/g;

/**
 * 外部サイトから読み取った文字列を、素の文字列として画面に出せる形に均す。
 *
 * 1. タグを落とす
 * 2. そのあとで実体参照を戻す
 * 3. 空白を詰めて 1 行にする
 * 4. 上限で切る
 *
 * 実体参照を「タグを落としたあと」に戻すのは、順序を逆にすると `&lt;script&gt;` が
 * 本物のタグに化けてしまうため。ここを通した値だけを D1 に入れる約束にしてあるので、
 * 表示する側は素の文字列として扱ってよい。
 *
 * 上限は嫌がらせ対策でもある。相手のページの本文をまるごと積まれると、1 通の
 * Webmention でこちらの容量を好きなだけ食える。
 */
export function toPlainText(raw: string, maxLength: number): string {
  const stripped = stripTags(raw);
  const decoded = stripped.replaceAll(
    entityPattern,
    (entity) => entities.get(entity) ?? entity,
  );
  const collapsed = decoded.replaceAll(whitespacePattern, " ").trim();

  return collapsed.length > maxLength
    ? collapsed.slice(0, maxLength)
    : collapsed;
}

/**
 * タグを落とす。`<` から次の `>` までを空白に置き換える。
 *
 * 正規表現ではなく素直な分割で書いてある。`<[^>]*>` のような書き方は、閉じない `<` の
 * あとに長い文字列が続くと戻り道を延々と試すので、処理時間が入力の二乗に伸びる。
 * 閉じ損ねたタグは末尾まで落とす (切れたタグを表に出さないので、こちらの方が安全)。
 */
function stripTags(raw: string): string {
  return raw
    .split("<")
    .map((part, index) => {
      if (index === 0) return part;
      const end = part.indexOf(">");
      return end === -1 ? "" : part.slice(end + 1);
    })
    .join(" ");
}
