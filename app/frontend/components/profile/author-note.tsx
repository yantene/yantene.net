import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import type { PublicProfile } from "~/backend/handlers/profile/profile-view";
import { FALLBACK_PROFILE_NAME } from "~/lib/profile-fallback";
import { SocialLinks } from "~/frontend/components/social/social-links";

interface AuthorNoteProps {
  /** 書き手のプロフィール。まだ同期されていなければ null。 */
  readonly profile: PublicProfile | null;
  /** `u-url` を絶対 URL にするため。 */
  readonly origin: string;
}

/**
 * 記事の末尾に置く筆者紹介。
 *
 * **この `p-author` が h-entry の筆者を答える印。** 以前は記事の冒頭 (article-header) に
 * sr-only で置いていたものを、見える形にしてここへ移した。h-entry の中に `p-author` が
 * 2 つ並ぶとパーサは先頭を採るので、**印はここ 1 つだけ**にすること。
 *
 * プロフィールが無いときは、以前と同じ sr-only の 1 行に倒す。印ごと消すと、初回同期の
 * 前や `profile.md` を消した直後に Webmention の著者発見が黙って壊れる。
 */
export function AuthorNote({ profile, origin }: AuthorNoteProps): React.JSX.Element {
  const { t } = useTranslation();

  if (profile === null) {
    return (
      <a className="sr-only p-author h-card" href={`${origin}/`} aria-hidden="true" tabIndex={-1}>
        {FALLBACK_PROFILE_NAME}
      </a>
    );
  }

  return (
    <section className="p-author h-card flex flex-col gap-4 rounded-lg border border-border/60 px-6 py-5 sm:flex-row sm:gap-6">
      {profile.avatarUrl !== null && (
        <img
          className="u-photo size-16 shrink-0 self-start rounded-full border border-border/60 object-cover"
          src={profile.avatarUrl}
          alt=""
        />
      )}

      <div className="flex flex-col gap-3">
        {/*
          名前がそのまま筆者のサイトへの参照を兼ねる。`p-name` と `u-url` を 1 つの
          リンクに載せるのは microformats2 の素直な書き方で、見えるものと機械が読むものが
          ずれない。
        */}
        <a className="p-name u-url font-semibold hover:text-primary" href={`${origin}/`}>
          {profile.name}
        </a>

        <p className="p-note text-[0.9rem] leading-relaxed text-foreground/85">
          {profile.tagline.map((line, index) => (
            <span key={line}>
              {index > 0 && <br />}
              {line}
            </span>
          ))}
        </p>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {profile.socials.length > 0 && (
            <SocialLinks
              links={profile.socials}
              className="flex items-center gap-4"
              linkClassName="press-control inline-flex text-xl text-foreground/85 transition-colors hover:text-primary"
            />
          )}
          {/* 区画の名前は訳さない (product.md「見える名前は訳さない」)。 */}
          <Link className="text-sm text-muted-foreground hover:text-primary" to="/about">
            {t("navigation.about")}
          </Link>
        </div>
      </div>
    </section>
  );
}
