/**
 * 著作権表示に出す期間。最初のノートを公開した年から、最後に公開した年まで。
 *
 * 「いま何年か」ではなくノートの公開年から引くのは、この表示が主張しているのが
 * サイトを開いていた期間ではなく、著作物を出した期間だからで、書いていない年を
 * 時計まかせに伸ばさないため。1 年しか公開していなければ from と to は同じ年になる。
 *
 * 読み出し (copyright.ts) と分けてあるのは、フッターが型だけを見に来るため。
 * 同じ場所に置くと、いつか値の import に変わったときに D1 と drizzle が
 * クライアントのバンドルへ黙って降りてくる。
 */
export interface CopyrightYears {
  readonly from: number;
  readonly to: number;
}

/** 全ページの loader が返す共通フィールド (フッターの著作権表示に渡る)。 */
export interface CopyrightData {
  readonly copyright: CopyrightYears;
}
