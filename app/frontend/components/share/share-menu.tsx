import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineLink, HiOutlineShare } from "react-icons/hi2";
import { SiBluesky, SiFacebook, SiX } from "react-icons/si";
import { buildClipboardPayload, buildShareTargets } from "./share-targets";
import type { ShareTarget } from "./share-targets";

/** コピーの結果を出しておく時間。読んで消えるまでの間だけ残す。 */
const FEEDBACK_DURATION_MS = 2000;

const icons = {
  x: SiX,
  bluesky: SiBluesky,
  facebook: SiFacebook,
} as const satisfies Record<ShareTarget["key"], React.ComponentType>;

type ShareMenuProps = {
  /** 共有する絶対 URL。相対パスだと貼った先で開けない。 */
  readonly url: string;
  readonly title: string;
};

type CopyState = "idle" | "copied" | "failed";

/*
 * 共有シートを呼べるかどうかを、サーバーとクライアントで別々に答える。
 *
 * `navigator.share` の有無はクライアントでしか分からない。effect で書き換えると余分な
 * 描画が挟まるので、サーバー用のスナップショットを持てる useSyncExternalStore で受ける。
 * ハイドレーションはサーバー側の答え (呼べない) で行われ、その後クライアントの答えに
 * 差し替わるため、SSR との食い違いも起きない。
 *
 * 購読はしない。読み込んだ後に生えたり消えたりする機能ではない。参照が変わると購読し直しに
 * なるので、関数はモジュールに置いて固定する。
 */
const unsubscribe = (): void => undefined;
const subscribeToNothing = (): (() => void) => unsubscribe;
const canShareHere = (): boolean => typeof navigator.share === "function";
const canShareOnServer = (): boolean => false;

/**
 * クリップボードに、リッチテキストと Markdown を同時に載せる。
 *
 * 貼り先が形式を選ぶので、こちらでどちらかに決め打ちしない。ClipboardItem を扱えない
 * 相手には Markdown だけを置く (何も起きないより、貼れる方がよい)。
 */
async function copyLink(url: string, title: string): Promise<void> {
  const { html, plain } = buildClipboardPayload(url, title);

  if (typeof ClipboardItem !== "function") {
    await navigator.clipboard.writeText(plain);
    return;
  }

  await navigator.clipboard.write([
    new ClipboardItem({
      "text/html": new Blob([html], { type: "text/html" }),
      "text/plain": new Blob([plain], { type: "text/plain" }),
    }),
  ]);
}

/*
 * 翻訳のキーは組み立てず、そのまま書く。`share.${state}` のように綴ると、キーを grep しても
 * 見つからない場所ができる (実際、ここで share.failed という無い鍵を引いていた)。
 */
function feedbackText(
  state: CopyState,
  t: (key: string) => string,
): string | undefined {
  if (state === "copied") return t("share.copied");
  if (state === "failed") return t("share.copyFailed");
  return undefined;
}

/**
 * 記事の末尾に置く共有の導線。
 *
 * OS の共有シートを呼べる環境ではそれに任せ、呼べない環境では共有先の一覧を開く。
 * 畳む器に `<details>` を使うのは、JS が動かない環境でも開いて素のリンクを踏めるため。
 *
 * 出し分けは描画では行わない。`navigator.share` の有無はクライアントでしか分からず、
 * SSR と食い違うと hydration mismatch になる (#156)。SSR とハイドレーション直後は必ず
 * 一覧側を描き、判定は effect の後に効かせて、trigger の振る舞いだけを差し替える。
 */
export function ShareMenu({ url, title }: ShareMenuProps): React.JSX.Element {
  const { t } = useTranslation();
  const canUseSystemShare = useSyncExternalStore(
    subscribeToNothing,
    canShareHere,
    canShareOnServer,
  );
  const [copyState, setCopyState] = useState<CopyState>("idle");

  // 結果は放っておくと居座るので、読める長さだけ出して畳む。
  useEffect(() => {
    if (copyState === "idle") return;

    const timer = globalThis.setTimeout(() => {
      setCopyState("idle");
    }, FEEDBACK_DURATION_MS);
    return () => {
      globalThis.clearTimeout(timer);
    };
  }, [copyState]);

  const handleTriggerClick = (event: React.MouseEvent<HTMLElement>): void => {
    if (!canUseSystemShare) return;

    // 共有シートを開くので、一覧は開かない。
    event.preventDefault();
    /*
     * 共有シートを閉じただけでも reject する。利用者が自分で閉じた結果に文句を
     * 言っても仕方がないので、ここは黙って戻る。
     */
    void navigator.share({ title, url }).catch(() => {});
  };

  const handleCopyClick = (): void => {
    void (async () => {
      try {
        await copyLink(url, title);
        setCopyState("copied");
      } catch {
        /*
         * 権限が下りないブラウザや、安全でない生成元では失敗する。黙って何も起きないと
         * 「押したのに何も起きない」になるので、失敗したことは出す。
         */
        setCopyState("failed");
      }
    })();
  };

  return (
    <details className="share-menu">
      <summary
        className="share-menu-trigger press-control"
        onClick={handleTriggerClick}
      >
        <HiOutlineShare aria-hidden />
        {t("share.title")}
      </summary>

      <div className="share-menu-panel">
        {buildShareTargets(url, title).map((target) => {
          const Icon = icons[target.key];
          return (
            <a
              key={target.key}
              href={target.href}
              target="_blank"
              // 開いた先から window.opener を辿られないようにする。
              rel="noreferrer"
              className="share-menu-item press-control"
            >
              <Icon aria-hidden />
              {t("share.shareOn", { service: target.label })}
            </a>
          );
        })}

        <button
          type="button"
          onClick={handleCopyClick}
          className="share-menu-item press-control"
        >
          <HiOutlineLink aria-hidden />
          {t("share.copyLink")}
        </button>

        {/*
          結果は読み上げにも届ける。入れ物は畳まず置いたままにしておくこと
          (現れる作りにすると、読み上げが落ちる読み手がいる)。
        */}
        <p className="share-menu-feedback" role="status">
          {feedbackText(copyState, t)}
        </p>
      </div>
    </details>
  );
}
