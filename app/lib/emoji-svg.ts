/**
 * リアクションの絵文字を、自分のところから配る Twemoji の SVG に対応づける。
 *
 * チップは記事ページに常設なので、フォントで組むと 617KB の woff2 を全記事ページで
 * 読むことになる (#200)。実際に出るのは押された絵文字だけなので、1 枚 1.7KB 前後の
 * SVG を必要なぶんだけ取りに行く形にした。パレットは開いたときだけ描かれるため、
 * あちらは今までどおりフォントで組む。
 *
 * SVG は `scripts/copy-emoji-svg.mjs` が postinstall で `public/emoji/svg/` へ写す。
 */

/**
 * 絵文字 1 つぶんの SVG の在り処。
 *
 * VS16 (U+FE0F) を落とすのは、Twemoji が異体字セレクタをファイル名に含めないため。
 * ❤️ (U+2764 U+FE0F) は `2764.svg` になる。
 *
 * **在ることは保証しない。** `@twemoji/svg` は Unicode 15 までで、フォント側は 17 に
 * 追随しているため、新しい絵文字には SVG が無い。描画側は `<img>` の `alt` に絵文字
 * そのものを置いてあるので、取れなければ素の文字が出る (意匠は環境まかせになる)。
 */
export function emojiSvgPath(emoji: string): string {
  // Twemoji のファイル名はコードポイントを - で繋いだもので、書記素ではなくこの単位で決まる。
  // oxlint-disable-next-line typescript/no-misused-spread -- 割りたいのはコードポイント。
  const name = [...emoji]
    .flatMap((character) => {
      const codePoint = character.codePointAt(0);
      // 分割は必ずコードポイント単位なので undefined にはならないが、型では除けない。
      if (codePoint === undefined || codePoint === 0xfe_0f) return [];
      return [codePoint.toString(16)];
    })
    .join("-");

  return `/emoji/svg/${name}.svg`;
}
