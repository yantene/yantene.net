import { useTranslation } from "react-i18next";
import { SiMarkdown } from "react-icons/si";
import { Link } from "react-router";

export interface NoteHeaderProps {
  readonly slug: string;
  readonly title: string;
  readonly imageUrl: string | null;
  readonly tags: readonly string[];
  readonly publishedOn: string;
  /** 絶対 URL を組むための出どころ。microformats の `u-url` に使う。 */
  readonly origin: string;
}

/**
 * 記事の頭。カバー画像・日付・表題・タグと、microformats2 の印を持つ。
 *
 * **この記事を指す `u-url` と書き手を表す `p-author h-card` はここにある。** Webmention を
 * 送る側・読む側のパーサ (Bridgy 等) が「誰の・何という記事への言及か」を辿るのに要る印で、
 * 消えても画面には何も出ない。
 *
 * ここが持つのは、entry の中に入る個々のプロパティだけである。**それらを束ねる `h-entry` と、
 * 本文を表す `e-content` はこの外側 (routes/notes.$slug.tsx) にある。** 束ねる側が外れると、
 * ここの印は宙に浮いた単独の項目になって誰のものでもなくなるので、両方が要る。
 *
 * 見張りも 2 つに分かれている。ここの印は note-header.mf2.test.tsx が、外側の `h-entry` /
 * `e-content` は routes/notes.$slug.mf2.test.tsx が固定している。
 */
export function NoteHeader({
  slug,
  title,
  imageUrl,
  tags,
  publishedOn,
  origin,
}: NoteHeaderProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <header className="note-header mb-8">
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
          className="note-header-cover"
        />
      )}
      {/*
        読み始める前に「いつの、何を読むのか」が分かるようにする。日付と種別を
        表題の上に置き、細い線で本文と隔てる。
      */}
      <p className="note-header-eyebrow">
        <time className="dt-published" dateTime={publishedOn}>
          {publishedOn.replaceAll("-", ".")}
        </time>
        <span className="note-header-kind">NOTE</span>
      </p>
      <h1 className="note-header-title p-name">{title}</h1>
      {/* 理由は上の JSDoc に書いた。`u-url` は相手のサイトで解決されるので絶対 URL にする。 */}
      <a className="sr-only u-url" href={`${origin}/notes/${slug}`}>
        {title}
      </a>
      <a className="sr-only p-author h-card" href={`${origin}/`}>
        yantene
      </a>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-base-content/60">
        {/*
          原文 Markdown は React Router のルートではなく Hono が返すので、
          Link ではなく素の <a> にする (クライアント遷移させない)。
        */}
        <a
          href={`/notes/${slug}.md`}
          className="press-control inline-flex items-center gap-1 hover:text-primary hover:underline"
        >
          <SiMarkdown aria-hidden="true" />
          {t("notes.viewMarkdown")}
        </a>
      </div>
      {tags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Link
              key={tag}
              to={`/notes?tag=${encodeURIComponent(tag)}`}
              className="badge badge-outline press-control gap-1 hover:badge-primary"
            >
              {tag}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
