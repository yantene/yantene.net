import { useState, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { HiXMark } from "react-icons/hi2";

/** 一度閉じたら以降は出さない。記事ごとではなくサイト全体で 1 回。 */
const DISMISSED_KEY = "yantene:reaction-hint-dismissed";

/**
 * 前に閉じたか (`useSyncExternalStore` の getSnapshot にあたる)。
 *
 * 閉じたかどうかは localStorage にしか無い。React の外にある値なので、state に写して
 * effect で追いかけるのではなく直に読む (effect の中で同期的に state を書くと、
 * 描くたびに連鎖して描き直しになる)。
 *
 * localStorage は環境によっては読むだけで落ちる (Safari のプライベートブラウズなど)。
 * そこでは**閉じた記録を残せない**ので、「閉じてある」とみなして出さない。断れない促しを
 * 出し続けるより、出さないほうがよい。
 */
function wasDismissed(): boolean {
  try {
    return globalThis.localStorage.getItem(DISMISSED_KEY) !== null;
  } catch {
    return true;
  }
}

/**
 * SSR では「閉じてある」を返す = 出さない (getServerSnapshot にあたる)。
 *
 * 閉じたかどうかはブラウザ側にしか無いので、サーバーで出すと初回の描画が必ず食い違う
 * (#156 と同じ hydration mismatch)。出す向きに倒せば、初回はサーバーと揃ったまま、
 * hydration の後に浮かび上がる。
 */
function wasDismissedOnServer(): boolean {
  return true;
}

/** 購読しないので、外すものも無い。 */
const unsubscribe = (): void => undefined;

/**
 * 記録の変化は購読しない。
 *
 * この画面で閉じたことは state で追う。他のタブでの操作まで追いかける必要はない
 * (次に開けば読み直される)。
 */
function subscribe(): () => void {
  return unsubscribe;
}

/** 閉じたことを覚える。書けない環境でも、この場で閉じることは妨げない。 */
function rememberDismissal(): void {
  try {
    globalThis.localStorage.setItem(DISMISSED_KEY, "1");
  } catch {
    // 記録は残せないので次に開くとまた出る。閉じられないよりはよい。
  }
}

/**
 * まだ押していない読み手に、リアクションを促す吹き出し。
 *
 * 出すかどうか (置き場所と、押したかどうか) は呼び出し側が決める。ここが持つのは
 * 「読み手が閉じたか」だけ。
 */
export function ReactionHint(): React.JSX.Element | null {
  const { t } = useTranslation();
  /*
   * 「この場で閉じた」を state で持つのは、記録を残せない環境でもバツを効かせるため。
   * `getItem` は通るのに `setItem` だけ落ちる環境 (容量超過など) があり、localStorage の
   * 読み書きだけに頼ると**押しても何も起きない**。
   */
  const [hasClosedHere, setClosedHere] = useState(false);
  const hasDismissedBefore = useSyncExternalStore(subscribe, wasDismissed, wasDismissedOnServer);

  if (hasClosedHere || hasDismissedBefore) return null;

  return (
    <div className="reaction-hint" role="note">
      <p className="reaction-hint-text">{t("reaction.hint")}</p>
      <button
        type="button"
        className="reaction-hint-close press-control"
        aria-label={t("reaction.hintClose")}
        onClick={() => {
          setClosedHere(true);
          rememberDismissal();
        }}
      >
        <HiXMark aria-hidden />
      </button>
    </div>
  );
}
