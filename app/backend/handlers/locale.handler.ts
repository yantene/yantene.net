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

/** ヘッダーに載せられる文字の範囲。空白 (0x20) から `~` (0x7e) まで。 */
const FIRST_PRINTABLE_CODE_POINT = 0x20;
const LAST_PRINTABLE_CODE_POINT = 0x7e;

/**
 * ヘッダーに載せられない文字を含むか。
 *
 * 落とすものが 2 種類ある。**制御文字**は `Location` に改行が混ざると応答が分割される
 * ため (レスポンス分割)。**0x7e を越える文字**はヘッダーの値が ByteString で、
 * 255 を越える符号位置の変換がそこで例外になるため — 手前で落とさないと、
 * `/記事` のような値を送られただけで 500 になる。
 *
 * ブラウザから送られてくる `location.pathname` は百分率符号化済みなので、素の
 * フォームがここで落ちることはない。
 */
function hasUnsafeHeaderCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code < FIRST_PRINTABLE_CODE_POINT || code > LAST_PRINTABLE_CODE_POINT) return true;
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
  if (hasUnsafeHeaderCharacter(raw)) return FALLBACK_RETURN_TO;
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

function badRequest(detail: string): Response {
  return createProblemResponse(httpStatus.BAD_REQUEST, "Bad Request", detail);
}

/** 本文をフォームとして読む。読めなければ null (投げさせない)。 */
async function readForm(request: Request): Promise<FormData | null> {
  try {
    return await request.formData();
  } catch {
    return null;
  }
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
    /*
     * 読めない本文はここで落とす。`formData()` は JSON や空の本文で投げるので、
     * 握らないと `onError` まで転がって 500 になる。**押した人の側の間違いを
     * こちらの故障として報せない。**
     */
    const form = await readForm(c.req.raw);
    if (form === null) return badRequest("The request body could not be read as a form.");

    const requested = form.get(localeField);

    /*
     * 読めない値は既定に倒さず 400 にする。倒すと、綴りを間違えたフォームが
     * 「押しても英語のまま」という形でだけ壊れ、誰も原因に辿り着けない (fail-loud)。
     */
    if (typeof requested !== "string" || !isSupportedLocale(requested)) {
      return badRequest("The requested locale is not supported.");
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
