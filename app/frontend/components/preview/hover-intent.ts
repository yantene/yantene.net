/** チップを出すまでの待ち。通り過ぎただけのカーソルには出さない。 */
export const OPEN_DELAY_MS = 300;

/**
 * 離れてから閉じるまでの猶予。リンクからチップへカーソルを移す間に閉じないためのもの。
 *
 * 長くすると「閉じにくい」になる。読み進めたい人には、離れたのに残り続けるチップが
 * いちばん邪魔になるので、移動に要るぶんだけに留める。
 */
export const CLOSE_DELAY_MS = 150;

export interface HoverIntentOptions<Subject> {
  readonly openDelayMs: number;
  readonly closeDelayMs: number;
  /** 待ちが明けた。出すものを用意する (取りに行くなら、ここから)。 */
  readonly onOpen: (subject: Subject) => void;
  readonly onClose: () => void;
}

/**
 * 「読み手がこれを見たがっているか」を、カーソルと焦点の出入りから決める。
 *
 * React にも DOM にも触らない。時計と出来事だけで決まるので、ここだけを偽の時計で
 * 確かめられる。
 *
 * - {@link enter}: リンクに乗った・焦点が当たった。待ちが明けたら出す
 * - {@link leave}: リンクから離れた。猶予のあと閉じる
 * - {@link hold} / {@link release}: カーソルがチップの上に居る間は閉じない
 * - {@link dismiss}: いますぐ閉じる (Esc・リンクを押した)
 */
export class HoverIntent<Subject> {
  readonly #options: HoverIntentOptions<Subject>;
  #openTimer: ReturnType<typeof setTimeout> | undefined;
  #closeTimer: ReturnType<typeof setTimeout> | undefined;
  #wanted: Subject | undefined;
  /** いま離れたばかりの相手。戻ってきたときだけ、閉じるのを取り消す。 */
  #left: Subject | undefined;
  #dismissed: Subject | undefined;
  #held = false;

  constructor(options: HoverIntentOptions<Subject>) {
    this.#options = options;
  }

  enter(subject: Subject): void {
    /*
     * 閉じるのを取り消すのは、離れた相手に戻ってきたときだけ。隣のリンクへ移ったときは
     * 前のチップをそのまま閉じさせる。取り消すと、次のチップが出るまで (相手が見えない
     * 記事なら離れるまでずっと) 前のリンクの中身が残る。
     */
    if (subject === this.#left || subject === this.#dismissed) clearTimeout(this.#closeTimer);
    /*
     * 閉じた相手には、一度離れるまで出し直さない。Esc で閉じても焦点はリンクに残って
     * いるし、カーソルもその上に居る。ここで出し直すと「閉じられないチップ」になる。
     */
    if (this.#dismissed === subject) return;
    if (this.#wanted === subject) return;

    this.#wanted = subject;
    clearTimeout(this.#openTimer);
    this.#openTimer = setTimeout(() => {
      this.#options.onOpen(subject);
    }, this.#options.openDelayMs);
  }

  leave(): void {
    this.#left = this.#wanted ?? this.#left;
    this.#dismissed = undefined;
    this.#wanted = undefined;
    clearTimeout(this.#openTimer);
    clearTimeout(this.#closeTimer);
    // チップの上にカーソルが居る間は閉じない。焦点だけが外れた (チップの中を押した) とき。
    if (this.#held) return;
    this.#closeTimer = setTimeout(() => {
      this.#options.onClose();
    }, this.#options.closeDelayMs);
  }

  hold(): void {
    this.#held = true;
    clearTimeout(this.#closeTimer);
  }

  release(): void {
    this.#held = false;
    this.leave();
  }

  dismiss(): void {
    clearTimeout(this.#openTimer);
    clearTimeout(this.#closeTimer);
    this.#dismissed = this.#wanted ?? this.#dismissed;
    this.#wanted = undefined;
    this.#held = false;
    this.#options.onClose();
  }

  /**
   * まだこれを見たがっているか。
   *
   * 中身を取りに行っている間に離れた相手へ、遅れてチップを出さないために問う。
   */
  wants(subject: Subject): boolean {
    return this.#wanted === subject;
  }

  /** 残っている待ちを捨てる。画面から外れるときに呼ぶ。 */
  dispose(): void {
    clearTimeout(this.#openTimer);
    clearTimeout(this.#closeTimer);
    // 取りに行っている最中の相手にも、遅れて出させない ({@link wants} が偽を返す)。
    this.#wanted = undefined;
  }
}
