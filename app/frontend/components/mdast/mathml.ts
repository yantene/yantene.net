/**
 * MathML を sanitize に通すための allowlist。
 *
 * 数式は refresh 時に MathML へ組んで MDAST に埋めてある (ADR 0013)。描画側は
 * それを hast として出すだけだが、`rehypeSanitize` の schema に無いタグ・属性は
 * 落ちるため、通す形をここに明示する。
 *
 * 正本は自分のリポジトリだが、他の要素と同じく素通しにはしない。並べるのは
 * 「組版の意味を持つだけの」タグと属性に限り、URL・スクリプト・inline style を
 * 運べるものは 1 つも入れない。
 */

/**
 * 通す MathML 要素。
 *
 * Temml の MathML 出力が使う要素に、MathML Core の基本要素を足したもの (ADR 0018)。
 * `mglyph` は入れない (src で外部の画像を読み込むため。本文の画像は Markdown で書く)。
 */
export const mathMlTagNames = [
  "math",
  "semantics",
  "annotation",
  "mrow",
  "mi",
  "mn",
  "mo",
  "ms",
  "mtext",
  "mspace",
  "mfrac",
  "msqrt",
  "mroot",
  "mstyle",
  "merror",
  "mpadded",
  "mphantom",
  "menclose",
  "msub",
  "msup",
  "msubsup",
  "munder",
  "mover",
  "munderover",
  "mmultiscripts",
  "mprescripts",
  "none",
  "mtable",
  "mtr",
  "mtd",
] as const;

/**
 * 通す属性。要素ごとに分けず、MathML の要素すべてに同じ一覧を当てる。
 *
 * どれも寸法・整列・書体といった組版の指定でしかなく、外部を参照する術がないため、
 * 要素ごとに刻んでも防御は増えない。`href` (MathML でもリンクを張れる)、`class`、`id` は
 * 意図的に外してある。
 *
 * **`style` はここにだけ通す。** Temml が表組みの桁や数式番号の位置を inline style で
 * 渡してくるため (ADR 0019)。この一覧が当たるのは MathML の要素だけなので、本文の段落や
 * 見出しに inline style が入ることはない (そちらは rehype-sanitize の既定が落とす)。
 */
export const mathMlAttributes = [
  // 全要素共通 (MathML Core)
  "style",
  "dir",
  "displaystyle",
  "mathbackground",
  "mathcolor",
  "mathsize",
  "mathvariant",
  "scriptlevel",
  // math
  "alttext",
  "display",
  "xmlns",
  // mo
  "fence",
  "form",
  "largeop",
  "lspace",
  "maxsize",
  "minsize",
  "movablelimits",
  "rspace",
  "separator",
  "stretchy",
  "symmetric",
  // mfrac
  "linethickness",
  // mspace / mpadded
  "depth",
  "height",
  "voffset",
  "width",
  // munder / mover / munderover
  "accent",
  "accentunder",
  // mtable / mtr / mtd
  "columnalign",
  "columnlines",
  "columnspacing",
  "columnspan",
  "rowalign",
  "rowlines",
  "rowspacing",
  "rowspan",
  // annotation
  "encoding",
  // menclose (MathML Core 外だが Temml が \cancel などで使う)
  "notation",
] as const;

/** `<math>` の中でしか許さない要素 (裸の `<mi>` などが本文に紛れ込むのを防ぐ)。 */
export const mathMlDescendants = mathMlTagNames.filter(
  (tagName) => tagName !== "math",
);
