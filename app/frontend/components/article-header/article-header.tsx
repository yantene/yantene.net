import { useTranslation } from "react-i18next";
import { HiOutlineCalendar, HiOutlineClock } from "react-icons/hi2";
import { Link } from "react-router";
import { toDisplayDate } from "~/frontend/lib/display-date";
import { PROFILE_PHOTO } from "~/lib/profile-fallback";

export interface ArticleHeaderProps {
  readonly slug: string;
  readonly title: string;
  readonly imageUrl: string | null;
  readonly publishedOn: string;
  /** 表題の言語 (BCP 47)。記事の DTO の `language` を渡す。日付や種別の札は UI の言語のまま。 */
  readonly language: string;
  /** 絶対 URL を組むための出どころ。microformats の `u-url` に使う。 */
  readonly origin: string;
  /** 書き手の本名。プロフィールが無ければ既定の名前 (FALLBACK_PROFILE_NAME) を渡す。 */
  readonly realName: string;
  /** 書き手の英語名。英語の画面では本名の代わりに添える。書いていなければ null。 */
  readonly realNameEn: string | null;
  /** 本文を読み終えるまでのおおよその分数。 */
  readonly readingMinutes: number;
  /** 名乗りの行の右に並べる道具の帯 (ArticleActions)。 */
  readonly actions: React.ReactNode;
}

/**
 * 記事の頭。カバー画像・表題・名乗りの行 (筆者・日付・読む時間) と道具の帯、microformats2 の印を持つ。
 *
 * 道具の帯 (リアクション・共有・原文) は `actions` で受け取り、名乗りの行の右に並べる。
 * 狭い幅では名乗りの行の下に回る。
 *
 * **この記事を指す `u-url` はここにある。** Webmention を送る側・読む側のパーサ (Bridgy 等) が
 * 「何という記事への言及か」を辿るのに要る印で、消えても画面には何も出ない。
 *
 * **書き手を表す `p-author h-card` はここには無い。** 記事の末尾の筆者紹介
 * (components/profile/author-note.tsx) が持っている。h-entry の中に `p-author` が
 * 2 つ並ぶとパーサは先頭を採るので、見える紹介とここの印を両立させられない。
 *
 * ここが持つのは、entry の中に入る個々のプロパティだけである。**それらを束ねる `h-entry` と、
 * 本文を表す `e-content` はこの外側 (routes/articles.$slug.tsx) にある。** 束ねる側が外れると、
 * ここの印は宙に浮いた単独の項目になって誰のものでもなくなるので、両方が要る。
 *
 * 見張りも 2 つに分かれている。ここの印は article-header.mf2.test.tsx が、外側の `h-entry` /
 * `e-content` は routes/articles.$slug.mf2.test.tsx が固定している。
 */
export function ArticleHeader({
  slug,
  title,
  imageUrl,
  publishedOn,
  language,
  origin,
  realName,
  realNameEn,
  readingMinutes,
  actions,
}: ArticleHeaderProps): React.JSX.Element {
  const { t, i18n } = useTranslation();
  /*
   * 筆者は「サイトの名前 (本名)」で名乗る (`やんてね (吉田 周平)` / `yantene (Shuhei YOSHIDA)`)。
   * サイトの名前は画面の言語に従うので翻訳リソース (`meta.title`) から引き、本名も英語の
   * 画面では英語名に替える。英語名が無ければ本名のまま。
   */
  const personalName = i18n.language === "en" ? (realNameEn ?? realName) : realName;
  const authorName = `${t("meta.title")} (${personalName})`;

  return (
    <header className="article-header mb-8">
      {/*
        カバー画像は表題より上、記事の先頭に置く。読み始める前に絵で記事の顔を
        立てる。ファーストビューに入るので lazy にはせず、最優先で取りに行く。
      */}
      {imageUrl !== null && (
        <img
          src={imageUrl}
          alt=""
          fetchPriority="high"
          decoding="async"
          className="article-header-cover"
        />
      )}
      <h1 lang={language} className="article-header-title p-name">
        {title}
      </h1>
      {/*
        理由は上の JSDoc に書いた。`u-url` は相手のサイトで解決されるので絶対 URL にする。

        機械に読ませるためだけの印なので、人には渡さない。`sr-only` は目に見えなくする
        だけで、タブ順にもアクセシビリティツリーにも残る。放っておくと、表題が二重に
        読まれたうえ、いまのページを指すだけのリンクにフォーカスが止まる (#287)。

        `aria-hidden` と `tabIndex={-1}` は必ず対で置くこと。読み上げから消しただけの
        到達できる要素は、焦点が当たっても何も読まれない状態になる。
      */}
      <a
        lang={language}
        className="sr-only u-url"
        href={`${origin}/articles/${slug}`}
        aria-hidden="true"
        tabIndex={-1}
      >
        {title}
      </a>
      {/*
        名乗りの行。左に「誰が・いつ・どれだけ」、右に道具の帯を置き、細い線で本文と隔てる。

        ⚠️ **筆者の名前と顔に `p-author` / `h-card` を付けないこと。** h-entry の筆者は
        末尾の筆者紹介 (AuthorNote) が名乗っている。ここにも付けると、パーサは先頭を採るので
        印が 2 つ並んで食い違う (product.md「p-author は記事の末尾にある」)。
      */}
      <div className="article-header-meta">
        <p className="article-header-byline">
          <Link to="/about" className="article-header-author press-control">
            <img className="article-header-author-photo" src={PROFILE_PHOTO} alt="" />
            {authorName}
          </Link>
          <span className="article-header-fact">
            <HiOutlineCalendar aria-hidden />
            <time className="dt-published" dateTime={publishedOn}>
              {toDisplayDate(publishedOn)}
            </time>
          </span>
          <span className="article-header-fact">
            <HiOutlineClock aria-hidden />
            {t("articles.readingTime", { count: readingMinutes })}
          </span>
        </p>
        {actions}
      </div>
      {/*
        タグは廃止した (ADR 0029) が、microformats2 のカテゴリは `article` で固定して残す。
        Post Type Discovery が `p-name` と `e-content` から導く型と同じ語なので、
        受け手から見て型とカテゴリが食い違わない。読み手には出さないので sr-only。
      */}
      <span className="sr-only p-category">article</span>
    </header>
  );
}
