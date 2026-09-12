import { Hono } from "hono";
import {
  isSupportedLocale,
  localeCookieMaxAgeSeconds,
  localeCookieName,
  localeField,
  localePath,
  localeReturnToField,
  type SupportedLocale,
} from "~/lib/i18n/locale";
import { httpStatus } from "~/lib/constants/http-status";
import { createProblemResponse } from "~/lib/problem-details";

/** 戻り先を決められなかったときの行き先。 */
const FALLBACK_RETURN_TO = "/";

/** 制御文字の境目。可視文字は 0x20 (空白) から始まり、0x7f は DEL。 */
const FIRST_VISIBLE_CODE_POINT = 0x20;
const DELETE_CODE_POINT = 0x7f;

/**
 * ヘッダーに載せられない文字を含むか。
 *
 * `Location` に改行が混ざると応答が分割される (レスポンス分割)。いまの Workers は
 * 不正な値で例外を投げるので分割はされないが、そこに頼らず手前で落とす。
 */
function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code < FIRST_VISIBLE_CODE_POINT || code === DELETE_CODE_POINT) return true;
  }
  return false;
}

/**
 * フォームが言ってきた戻り先を、そのまま使える形に絞る。
 *
 * 読み手が好きに書ける値なので、**同一オリジンのパスだけを通す**。素通しすると
 * 「ロケールを切り替えたら知らないサイトに飛んだ」という踏み台になる。
 *
 * `//example.com` と `/\example.com` はスキーム相対 URL としてブラウザに読まれ、
 * 先頭が `/` でも別のオリジンへ飛ぶ。`/` 始まりだけを見る判定では漏れるので、
 * この 2 つを名指しで落とす。
 */
export function safeReturnTo(raw: string | undefined): string {
  if (raw === undefined || raw.length === 0) return FALLBACK_RETURN_TO;
  if (!raw.startsWith("/")) return FALLBACK_RETURN_TO;
  if (raw.startsWith("//") || raw.startsWith("/\\")) return FALLBACK_RETURN_TO;
  if (hasControlCharacter(raw)) return FALLBACK_RETURN_TO;
  return raw;
}

/**
 * 選ばれたロケールを預ける Set-Cookie を組み立てる。
 *
 * `HttpOnly` は付けない。中身は読み手が自分で選んだ表示の好みで、盗まれて困るものが
 * 何も入っていない。読める状態にしておくと、後からクライアント側だけで切り替える手を
 * 足せる (いまは往復して切り替える)。
 *
 * @param options.secure development 以外では必ず true (secure by default)
 */
export function buildLocaleCookie(
  locale: SupportedLocale,
  options: { readonly secure: boolean },
): string {
  return [
    `${localeCookieName}=${locale}`,
    `Max-Age=${String(localeCookieMaxAgeSeconds)}`,
    "Path=/",
    // 他所からの遷移でも送ってほしい (リンクを踏んで来た人にも選んだ言語で出す)。
    "SameSite=Lax",
    ...(options.secure ? ["Secure"] : []),
  ].join("; ");
}

/**
 * ロケールを選ぶ受け口。POST /locale。
 *
 * **JavaScript を前提にしない。** ヘッダーの切り替えは素の `<form method="post">` で、
 * ここが cookie を置いて元のページへ 303 で戻す。読む側 (`resolve-locale.ts`) は
 * 既にこの cookie を最優先で見るので、次の描画から選ばれた言語になる。
 *
 * ページではなく副作用なので Hono で完結させる (React Router へは委譲しない)。
 * GET にしないのは、リンクの先読みや事前取得で勝手に言語が変わらないようにするため。
 */
export function createLocaleRouter(): Hono<{ Bindings: Env }> {
  const router = new Hono<{ Bindings: Env }>();

  router.post(localePath, async (c) => {
    const form = await c.req.formData();
    const requested = form.get(localeField);

    /*
     * 読めない値は既定に倒さず 400 にする。倒すと、綴りを間違えたフォームが
     * 「押しても英語のまま」という形でだけ壊れ、誰も原因に辿り着けない (fail-loud)。
     */
    if (typeof requested !== "string" || !isSupportedLocale(requested)) {
      return createProblemResponse(
        httpStatus.BAD_REQUEST,
        "Bad Request",
        "The requested locale is not supported.",
      );
    }

    // ファイルが送られてくれば File になる。文字列でなければ「言ってこなかった」と扱う。
    const rawReturnTo = form.get(localeReturnToField);
    const returnTo = safeReturnTo(typeof rawReturnTo === "string" ? rawReturnTo : undefined);

    return new Response(null, {
      // POST の結果を GET で見に行かせる。再読み込みで再送信にならない。
      status: httpStatus.SEE_OTHER,
      headers: {
        Location: returnTo,
        "Set-Cookie": buildLocaleCookie(requested, {
          // CSP と同じく development でだけ外す (dev は http で開くことがある)。
          secure: c.env.APP_ENV !== "development",
        }),
      },
    });
  });

  return router;
}
