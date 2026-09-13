import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { HiOutlineArrowLeftOnRectangle, HiOutlineArrowRightOnRectangle } from "react-icons/hi2";
import { signInPath, signOutPath } from "~/lib/constants/sign-in";

/** 足元の他の導線と字も反応も揃える。 */
const CONTROL_CLASS =
  "press-control inline-flex items-center gap-1.5 text-xs text-foreground/80 underline-offset-4 transition-colors hover:text-primary hover:underline";

interface SignInStateProps {
  /**
   * ログイン中として描くか。**Storybook と テストのためだけの口。**
   *
   * 渡さなければ `/api/v1/me` を引いて決める。渡すとその値で固定し、照会しない。
   */
  readonly signedIn?: boolean;
}

/**
 * 足元の Sign in / Sign out (#490)。
 *
 * `/sign-in` はナビに出さないので、常設の導線はここだけ。**どちらの字が出ているかが
 * そのままログイン状態の表示**を兼ねる。
 *
 * ## サーバー側では描かない
 *
 * ログイン状態をサーバーで描くと、HTML が人によって変わる。経路のどこかに載ると他人に
 * 配られるし、ハイドレーションの穴も増える (#480)。**SSR では常に `Sign in` を描き、**
 * マウント後に `/api/v1/me` を引いて入れ替える。
 *
 * JavaScript が動かない環境では `Sign in` のまま。押しても、ログイン済みなら
 * `/sign-in` の loader が `/` へ返すので破綻しない。
 */
export function SignInState({ signedIn }: SignInStateProps): React.JSX.Element {
  const { t } = useTranslation();
  const [detected, setDetected] = useState(false);

  useEffect(() => {
    // 渡されていれば照会しない (Storybook / テスト)。
    if (signedIn !== undefined) return;

    const aborter = new AbortController();

    async function detect(): Promise<boolean> {
      const response = await fetch("/api/v1/me", {
        signal: aborter.signal,
        headers: { accept: "application/json" },
      });
      if (!response.ok) return false;

      const body: unknown = await response.json();
      return (
        typeof body === "object" &&
        body !== null &&
        (body as { signedIn?: unknown }).signedIn === true
      );
    }

    /*
     * 読めない応答も、中断も、失敗も「ログインしていない」に倒す。倒した先は Sign in の
     * 字で、押せば入り直せる。逆に倒すと、入っていない人に Sign out を見せることになる。
     */
    detect()
      .then(setDetected)
      .catch(() => {
        setDetected(false);
      });

    return () => {
      aborter.abort();
    };
  }, [signedIn]);

  if (signedIn ?? detected) {
    return (
      // 出ていくのは副作用なので POST。受け口が Origin を見て他所からの送信を落とす。
      <form method="post" action={signOutPath}>
        <button type="submit" className={CONTROL_CLASS}>
          {/* 絵の意味は文字が持つので、読み上げには渡さない。 */}
          <HiOutlineArrowLeftOnRectangle aria-hidden="true" />
          {t("signIn.signOut")}
        </button>
      </form>
    );
  }

  return (
    /*
     * `Link` ではなく素の `a` にする。`/sign-in` の loader はログイン済みなら `/` へ
     * 返すが、クライアント側の遷移だとその往復が読み手には何も起きないように見える。
     */
    <a href={signInPath} className={CONTROL_CLASS}>
      <HiOutlineArrowRightOnRectangle aria-hidden="true" />
      {t("signIn.title")}
    </a>
  );
}
