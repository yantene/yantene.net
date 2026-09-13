import type { MailMessage, EmailAddress } from "~/backend/domain/auth";
import type { SupportedLocale } from "~/lib/i18n/locale";

/**
 * マジックリンクのメールの文面。
 *
 * **画面の翻訳リソース (`app/lib/i18n/locales`) には置かない。** あちらは i18next が
 * 描くときに引くもので、ここは配信の文面。混ぜると、画面に出ない字が「訳し忘れ」に
 * 見えて直されたり、メールの都合で画面側の鍵が増えたりする。
 */
interface SignInMailCopy {
  readonly subject: string;
  /** リンクの手前に出す 1 文。 */
  readonly lead: string;
  /** 押し場所の字。 */
  readonly action: string;
  /** 押せなかった人に URL をそのまま示す前置き。 */
  readonly fallback: string;
  /** 寿命の断り書き。 */
  readonly expiry: string;
  /** 頼んでいない人への 1 文。 */
  readonly unsolicited: string;
}

const copy: Record<SupportedLocale, SignInMailCopy> = {
  ja: {
    subject: "yantene.net にログインする",
    lead: "下のリンクを開くと yantene.net にログインできます。",
    action: "Sign in",
    fallback: "リンクを開けないときは、次の URL をブラウザに貼り付けてください。",
    expiry: "このリンクは 15 分で使えなくなります。一度使うと無効になります。",
    unsolicited: "心当たりが無ければ、このメールは捨ててください。開かなければ何も起きません。",
  },
  en: {
    subject: "Sign in to yantene.net",
    lead: "Open the link below to sign in to yantene.net.",
    action: "Sign in",
    fallback: "If the link does not open, paste this URL into your browser.",
    expiry: "This link stops working in 15 minutes, and once it is used.",
    unsolicited:
      "If you did not ask for this, throw this message away. Nothing happens unless the link is opened.",
  },
};

/** HTML に埋める前に、字として読ませたい文字を逃がす。 */
function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/**
 * 送る 1 通を組み立てる。
 *
 * **素のテキストを必ず入れる。** HTML を出さない読み方をする人がいるのと、URL だけの
 * 短い本文は迷惑メール判定を受けやすいため。
 */
export function buildSignInMail(params: {
  readonly to: EmailAddress;
  readonly url: string;
  readonly locale: SupportedLocale;
}): MailMessage {
  const text = copy[params.locale];
  const href = escapeHtml(params.url);

  return {
    to: params.to,
    subject: text.subject,
    text: [text.lead, "", params.url, "", text.expiry, text.unsolicited].join("\n"),
    html: [
      `<p>${escapeHtml(text.lead)}</p>`,
      `<p><a href="${href}">${escapeHtml(text.action)}</a></p>`,
      `<p>${escapeHtml(text.fallback)}<br><a href="${href}">${href}</a></p>`,
      `<p>${escapeHtml(text.expiry)}</p>`,
      `<p>${escapeHtml(text.unsolicited)}</p>`,
    ].join("\n"),
  };
}
