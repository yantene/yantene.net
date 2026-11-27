import { useEffect, useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineLink, HiOutlineShare } from "react-icons/hi2";
import {
  SiBluesky,
  SiFacebook,
  SiHatenabookmark,
  SiMastodon,
  SiThreads,
  SiX,
} from "react-icons/si";
import { buildClipboardPayload, buildShareTargets } from "./share-targets";
import type { ShareTarget } from "./share-targets";

/** コピーの結果を出しておく時間。読んで消えるまでの間だけ残す。 */
const FEEDBACK_DURATION_MS = 2000;

/*
 * 共有先の印。**`className` を受け取れる型で持つ** (描くときに `brand-mark` を付ける
 * ため。色は `brand-marks.css` が 1 か所で決める)。
 */
type BrandIcon = React.ComponentType<{
  readonly className?: string;
  readonly "aria-hidden"?: boolean;
}>;

/*
 * 印と、その色を決めるクラス。
 *
 * **色は社ごとの規定で決まる。** 黒を許す社は `brand-mark` だけで黒になり、黒を許さない
 * 社 (Facebook とはてブ) だけが色のクラスを足す。クラス名は組み立てずに書き切る
 * (grep で見つからない場所を作らないため)。出典は brand-marks.css。
 */
const marks = {
  x: { Icon: SiX, className: "brand-mark" },
  facebook: { Icon: SiFacebook, className: "brand-mark brand-mark-facebook" },
  bluesky: { Icon: SiBluesky, className: "brand-mark" },
  mastodon: { Icon: SiMastodon, className: "brand-mark" },
  threads: { Icon: SiThreads, className: "brand-mark" },
  hatenaBookmark: { Icon: SiHatenabookmark, className: "brand-mark brand-mark-hatena-bookmark" },
} as const satisfies Record<
  ShareTarget["key"],
  { readonly Icon: BrandIcon; readonly className: string }
>;

/** 共有先の名前。はてなだけは言語で呼び名が変わる (日本語では「はてなブックマーク」)。 */
function serviceName(target: ShareTarget, t: (key: string) => string): string {
  if (target.key === "hatenaBookmark") return t("share.hatenaBookmark");
  return target.label;
}

type ShareBarProps = {
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
 * 見つからない場所ができる (実際、ここで share.failed という無いキーを引いていた)。
 */
function feedbackText(state: CopyState, t: (key: string) => string): string | undefined {
  if (state === "copied") return t("share.copied");
  if (state === "failed") return t("share.copyFailed");
  return undefined;
}

/**
 * 記事の上と下に置く共有の帯。共有先の印を横 1 列に並べる。
 *
 * **畳まない。** 押すまで行き先が見えない作りだと、共有先を選ぶ前に「共有するか」を
 * 一度決めさせることになる。6 つの印と「リンクをコピー」なら 44px の押し場所で並べても
 * 本文の幅に収まる。
 *
 * 印だけで字は出さないので、**名前は `aria-label` と `title` で持たせる** (読み上げと、
 * マウスを載せたときの手がかり)。
 *
 * OS の共有シートは、呼べる環境でだけ末尾に押し場所を足す。`navigator.share` の有無は
 * クライアントでしか分からないので、SSR とハイドレーション直後は出さず、判定は
 * useSyncExternalStore のクライアント側の答えで効かせる (#156)。
 */
export function ShareBar({ url, title }: ShareBarProps): React.JSX.Element {
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

  const handleSystemShareClick = (): void => {
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
    <div className="share-bar" role="group" aria-label={t("share.title")}>
      <div className="share-bar-items">
        {buildShareTargets(url, title).map((target) => {
          const { Icon, className } = marks[target.key];
          const name = t("share.shareOn", { service: serviceName(target, t) });
          return (
            <a
              key={target.key}
              href={target.href}
              target="_blank"
              // 開いた先から window.opener を辿られないようにする。
              rel="noreferrer"
              className="share-bar-item press-control"
              aria-label={name}
              title={name}
            >
              {/*
              印には必ず `brand-mark` を付ける (marks の className に入っている)。付けないと、
              帯の字の色 (紺) と hover の primary がそのまま印に流れ、各社の recolor 禁止に
              当たる。hover で染めるのは印ではなく台のほう (share-bar.css)。
            */}
              <Icon className={className} aria-hidden />
            </a>
          );
        })}

        <button
          type="button"
          onClick={handleCopyClick}
          className="share-bar-item share-bar-tool press-control"
          aria-label={t("share.copyLink")}
          title={t("share.copyLink")}
        >
          <HiOutlineLink aria-hidden />
        </button>

        {canUseSystemShare && (
          <button
            type="button"
            onClick={handleSystemShareClick}
            className="share-bar-item share-bar-tool press-control"
            aria-label={t("share.more")}
            title={t("share.more")}
          >
            <HiOutlineShare aria-hidden />
          </button>
        )}
      </div>

      {/*
        結果は読み上げにも届ける。入れ物は畳まず置いたままにしておくこと
        (現れる作りにすると、読み上げが落ちる読み手がいる)。
      */}
      <p className="share-bar-feedback" role="status">
        {feedbackText(copyState, t)}
      </p>
    </div>
  );
}
