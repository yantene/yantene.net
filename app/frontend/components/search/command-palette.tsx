import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiMagnifyingGlass } from "react-icons/hi2";
import { Link, useNavigate } from "react-router";
import {
  articlePagePath,
  searchArticles,
  searchPagePath,
  type SearchArticles,
  type SearchResult,
} from "./search-results";

/**
 * 打ち終わるのを待つ時間。
 *
 * 打つたびに投げると、1 語打ち込む間に何本も飛ぶ。短くしすぎると打っている最中の
 * 中途半端な語で結果が入れ替わり、長くすると打ち終えてから間が空く。
 */
const DEBOUNCE_MS = 150;

/**
 * パレットが開いている間、後ろのページを動かさないための印。
 *
 * `<dialog>` を modal で開いても、背後のページのスクロールまでは止まらない。
 * `style` を直に触らず属性で切り替えるのは、連続値でない見た目の切り替えを CSS 側に
 * 置いておくため (rules/architecture.md)。
 */
const SCROLL_LOCK_ATTRIBUTE = "data-modal-open";

/*
 * スクロールバーの場所を空けておく印。**錠と分けてあるのは、空けるべき場面が狭いため。**
 *
 * 錠を掛けるとスクロールバーが消えるので、その幅のぶん中身が横へ寄る。空けておけば
 * 寄らない。ただし**そもそもスクロールバーが出ていないページで空けると、今度は逆へ
 * 寄る**。だから「いま出ているか」を見てから立てる。
 *
 * スクロールバーが画面に重なる環境 (macOS の既定など) では幅が 0 なので、印は立たない。
 */
const SCROLL_GUTTER_ATTRIBUTE = "data-modal-gutter";

type Status = "idle" | "loading" | "ready" | "failed";

/**
 * 取りに行った結果。**どの語に対する結果かを一緒に持つ。**
 *
 * 語だけを見て結果を出すと、打ち替えた直後の一瞬、前の語の結果が新しい語の結果の顔を
 * して並ぶ。ここで対にしておけば、描画のときに「いまの語のものか」を確かめられる。
 */
type Outcome =
  | { readonly query: string; readonly results: readonly SearchResult[] }
  | { readonly query: string; readonly failed: true };

interface CommandPaletteProps {
  readonly open: boolean;
  /** 閉じたいとき呼ぶ。Esc・暗がりの押下・行き先を選んだときのすべてを通る。 */
  readonly onClose: () => void;
  /**
   * 検索の取り方。既定は `/api/v1/search` を叩く。
   *
   * **毎描画で作り直さないこと。** 検索を走らせる effect の依存に入っているので、
   * その場で組んだ関数を渡すと打っていないのに投げ直しが起き続ける。
   */
  readonly search?: SearchArticles;
}

/**
 * キーボードから開く検索。
 *
 * **探す手立てはこれだけ。** 一覧 (`/articles`) に検索欄は置いていない。**行き止まりに
 * しない**ため、決めきれないときは `/articles?q=` へ送り出す (結果が無いときの Enter と、
 * 足元のリンク)。一覧はその結果を描けるので、絞り込んだ並びをそのまま渡せる。
 *
 * 開く仕掛けはここに持たない。`⌘K` / `Ctrl+K` を拾うのはヘッダーで、全ページに 1 つ
 * だけ置きたいのはそちら (header.tsx)。ここは「開けと言われたら開く」だけにしてある。
 *
 * 焦点は入力欄に置いたまま、`aria-activedescendant` で選択中の行を指す。行そのものへ
 * 焦点を移すと、選ぶたびに入力欄から焦点が外れて字を打ち足せなくなる。
 */
export function CommandPalette({
  open,
  onClose,
  search = searchArticles,
}: CommandPaletteProps): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  /** 選ばれている行。**どの語に対する選択かを一緒に持つ** (理由は {@link Outcome})。 */
  const [choice, setChoice] = useState<{ readonly query: string; readonly index: number }>({
    query: "",
    index: 0,
  });

  const trimmed = query.trim();

  /*
   * 出すものは描画のときに導く。状態として持つのは「取りに行った結果」だけにして、
   * 打ち替えた瞬間に前の語の結果が残らないようにする。
   */
  const settled = outcome !== null && outcome.query === trimmed ? outcome : null;
  const results = settled !== null && "results" in settled ? settled.results : [];
  const status: Status = resolveStatus(trimmed, settled);
  // 語が変われば先頭に戻る。結果が縮んだときは、消えた行を指したままにしない。
  const activeIndex =
    results.length === 0
      ? 0
      : Math.min(choice.query === trimmed ? choice.index : 0, results.length - 1);

  const optionId = (index: number): string => `${listId}-option-${String(index)}`;
  const activeId = results.length > 0 ? optionId(activeIndex) : null;

  /*
   * 選んでいる行を、見えるところまで連れてくる。
   *
   * 結果の一覧は高さで頭打ちにして中だけを動かすので (command-palette.css)、上下で
   * 送っていくと選ばれた行が枠の外に出る。焦点は入力欄にあるままなので、ブラウザが
   * 勝手に追いかけてはくれない。
   *
   * `block: "nearest"` にしてあるので、既に見えている行では何も起きない。マウスで
   * 指して選び直したときに一覧が飛び跳ねないのはこのため。
   */
  useEffect(() => {
    if (activeId === null) return;

    document.getElementById(activeId)?.scrollIntoView({ block: "nearest" });
  }, [activeId]);

  /*
   * 開け閉めは DOM の側に命じる。`open` 属性を描画で渡すと非 modal で開いてしまい、
   * 焦点が閉じ込められず、Esc でも閉じない。
   */
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog === null) return;

    if (open && !dialog.open) {
      dialog.showModal();
      inputRef.current?.focus();
    }
    if (!open && dialog.open) dialog.close();

    /*
     * **測るのは錠を掛ける前。** 掛けたあとはスクロールバーが消えているので、何を測っても
     * 0 になる。`innerWidth` は画面の幅、`clientWidth` はスクロールバーを除いた幅。
     */
    const root = document.documentElement;
    root.toggleAttribute(SCROLL_GUTTER_ATTRIBUTE, open && globalThis.innerWidth > root.clientWidth);
    root.toggleAttribute(SCROLL_LOCK_ATTRIBUTE, open);

    // 開いたまま外されたときのため。印だけが残ると、ページが二度と動かなくなる。
    return () => {
      root.removeAttribute(SCROLL_LOCK_ATTRIBUTE);
      root.removeAttribute(SCROLL_GUTTER_ATTRIBUTE);
    };
  }, [open]);

  useEffect(() => {
    if (trimmed.length === 0) return;

    const controller = new AbortController();
    const timer = globalThis.setTimeout(() => {
      void (async () => {
        try {
          setOutcome({ query: trimmed, results: await search(trimmed, controller.signal) });
        } catch {
          /*
           * 畳んだ要求も例外で返る。畳んだのはこちらで、次の語の要求が既に飛んでいる
           * ので、ここで失敗として出すと打っている最中に赤い字が点滅する。
           */
          if (controller.signal.aborted) return;
          setOutcome({ query: trimmed, failed: true });
        }
      })();
    }, DEBOUNCE_MS);

    return () => {
      globalThis.clearTimeout(timer);
      controller.abort();
    };
  }, [trimmed, search]);

  /*
   * 閉じたことを受け取る場所。
   *
   * 暗がりの押下も、行き先を選んだときも、最後はここに集まる (親が `open` を降ろすと、
   * 上の effect が `dialog.close()` を呼ぶ)。ここで語を空にしておかないと、次に開いた
   * ときに前回の語と結果が並び、いま探しているものと取り違える。
   *
   * ⚠️ **`close` だけに頼らないこと。** Esc で閉じたとき、`cancel` は来るのに `close`
   * が来ないブラウザがある (Chrome 152 で確認。素の `<dialog>` でも同じなので、この
   * 部品の作りとは関係ない)。`close` だけを見ていると `open` が降りないまま板だけ
   * 消えるので、**スクロールの錠が掛かったままになり、次に `⌘K` を押しても開かない**
   * (親から見れば既に開いている扱いなので、状態が変わらず effect も走らない)。
   *
   * 両方から呼ばれても困らない。語を空にするのも `onClose` も、2 度やって変わらない。
   */
  const handleDialogClose = (): void => {
    setQuery("");
    onClose();
  };

  /*
   * キーボードから選んだときの経路。マウスで押したときは `<Link>` 自身が遷移する
   * ので、こちらは通らない。
   */
  const goTo = (path: string): void => {
    onClose();
    void navigate(path);
  };

  const moveActive = (delta: number): void => {
    if (results.length === 0) return;
    setChoice({ query: trimmed, index: (activeIndex + delta + results.length) % results.length });
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveActive(1);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveActive(-1);
      return;
    }
    if (event.key !== "Enter") return;

    event.preventDefault();
    const active = results.at(activeIndex);
    // 選べる行があればそこへ。無ければ一覧へ送って、探し方ごと引き渡す。
    if (active !== undefined) {
      goTo(articlePagePath(active.slug));
      return;
    }
    if (trimmed.length > 0) goTo(searchPagePath(trimmed));
  };

  /*
   * 暗がりを押したら閉じる。
   *
   * jsx-a11y の 2 つを外している。キーボードからの同じ操作 (Esc) はブラウザ既定が
   * 受け持っていて、こちらから足す余地が無い。規則はそれを見られず、「押せるのに
   * キーで操作できない」と読んでしまう。
   */
  return (
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions -- Esc はブラウザ既定が受け持つ
    <dialog
      ref={dialogRef}
      className="command-palette"
      aria-label={t("search.title")}
      onClose={handleDialogClose}
      /* Esc。既定の動き (板を閉じる) は止めない — 止めると Esc で閉じられなくなる。 */
      onCancel={handleDialogClose}
      onClick={(event) => {
        // 中身への押下では target が中の要素になる。暗がりのときだけ一致する。
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="command-palette-panel">
        <div className="command-palette-field">
          <HiMagnifyingGlass className="command-palette-icon" aria-hidden />
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded={results.length > 0}
            aria-controls={listId}
            aria-activedescendant={activeId ?? undefined}
            aria-label={t("search.title")}
            placeholder={t("search.placeholder")}
            autoComplete="off"
            className="command-palette-input"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            onKeyDown={handleKeyDown}
          />
        </div>

        <div
          id={listId}
          role="listbox"
          aria-label={t("search.title")}
          className="command-palette-results"
        >
          {results.map((result, index) => (
            <Link
              key={result.slug}
              id={optionId(index)}
              to={articlePagePath(result.slug)}
              role="option"
              aria-selected={index === activeIndex}
              /*
               * 焦点は入力欄に据え置く。タブ順から外しておかないと、結果が出るたびに
               * 焦点の行き先が増えて、Tab で入力欄から出られなくなる。
               */
              tabIndex={-1}
              className={`command-palette-result press-surface${
                index === activeIndex ? " is-active" : ""
              }`}
              onClick={onClose}
              onMouseEnter={() => {
                // 指しているものと選ばれているものを揃える。押す前に一致させておかないと、
                // マウスで指した行と Enter の行き先が食い違う。
                setChoice({ query: trimmed, index });
              }}
            >
              <span className="command-palette-result-title">{result.title}</span>
              <span className="command-palette-result-summary">{result.summary}</span>
            </Link>
          ))}
        </div>

        {/*
          状況は 1 か所にまとめて読み上げる。結果の一覧と別の場所に散らすと、
          「何も無い」のか「まだ取りに行っている」のかが読み上げの順で分からなくなる。
        */}
        <p className="command-palette-status" role="status">
          {statusText(t, { status, count: results.length })}
        </p>

        <div className="command-palette-footer">
          <p className="command-palette-hints">
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            <span>{t("search.hintMove")}</span>
            <kbd>↵</kbd>
            <span>{t("search.hintOpen")}</span>
            <kbd>Esc</kbd>
            <span>{t("search.hintClose")}</span>
          </p>
          {trimmed.length > 0 && (
            <Link
              to={searchPagePath(trimmed)}
              className="command-palette-see-all press-control"
              onClick={onClose}
            >
              {t("search.seeAll")}
            </Link>
          )}
        </div>
      </div>
    </dialog>
  );
}

/** いまの語に対して、どこまで進んでいるか。 */
function resolveStatus(trimmed: string, settled: Outcome | null): Status {
  if (trimmed.length === 0) return "idle";
  // 結果がまだ無いのは、待っている間か、取りに行っている間のどちらか。
  if (settled === null) return "loading";
  return "failed" in settled ? "failed" : "ready";
}

/**
 * いまの状況を表す一文。
 *
 * 翻訳のキーは組み立てず、そのまま書く。`search.${status}` のように綴ると、キーを
 * grep しても見つからない場所ができる (share-menu.tsx に同じ注意がある)。
 */
function statusText(
  t: (key: string, options?: Record<string, unknown>) => string,
  { status, count }: { status: Status; count: number },
): string | undefined {
  if (status === "idle") return t("search.hint");
  if (status === "loading") return t("search.searching");
  if (status === "failed") return t("search.failed");
  if (count === 0) return t("search.empty");
  return undefined;
}
