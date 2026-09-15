import { useTranslation } from "react-i18next";
import { Link } from "react-router";
import { TaglineLines } from "./tagline-lines";
import type { PublicProfile } from "~/backend/handlers/profile/profile-view";
import { FALLBACK_PROFILE_NAME, PROFILE_PHOTO } from "~/lib/profile-fallback";
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
 * 見出しは読み上げにしか出さない。顔と名前が並んでいれば誰のことかは目で分かるが、
 * 読み上げでは本文の続きとして流れてしまうため、区画の名前だけを置く
 * (画面に出ない名前は訳す。product.md「見える名前は訳さない」)。
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
    <section className="author-note">
      <h2 className="sr-only">{t("articles.author")}</h2>

      {/*
        印を持つのは中の器のほうにする。外の `<section>` には見出しが入っており、
        h-card の中に入れるとパーサが名前の候補として拾う (`p-name` を明示してある間は
        実害が出ないが、印の中には印として読ませたいものだけを置く)。
      */}
      <div className="author-note-card p-author h-card">
        {/*
          顔はサイトのアイコン。`/about` の名乗りと同じものを、小さく出す。

          押すと `/about` へ行く。**人には渡さない** (`aria-hidden` と `tabIndex={-1}`
          の対)。すぐ右の名前が同じ行き先を持っているので、読み上げとタブ順に 2 つ並べる
          理由が無い。片方だけ置くと、焦点が当たっても何も読まれない要素になる (#287)。
        */}
        <Link className="author-note-photo-link" to="/about" aria-hidden="true" tabIndex={-1}>
          <img className="author-note-photo u-photo" src={PROFILE_PHOTO} alt="" />
        </Link>

        <div className="author-note-body">
          {/*
            名前を押すと `/about` へ行く。**書いた人の紹介を読みたい人が押す場所**なので、
            トップではなくあちらへ連れて行く。

            ⚠️ **`u-url` はここに載せない。** あれは「その人の URL」を答える印で、
            トップの代表 h-card が `/` を指している。ここだけ `/about` にすると、
            読んだ側から見て同じ人に結びつかなくなる。印は下の sr-only が持つ。
          */}
          <Link className="author-note-name p-name press-control" to="/about">
            {profile.name}
          </Link>

          {/*
            機械に読ませるためだけの、その人の URL。見える相方 (名前のリンク) は
            `/about` を指しているので、印だけを別に置く。`aria-hidden` と
            `tabIndex={-1}` は必ず対で置くこと (#287)。
          */}
          <a className="sr-only u-url" href={`${origin}/`} aria-hidden="true" tabIndex={-1}>
            {origin}
          </a>

          {/*
            ここだけ改行を畳んで流す。書かれた改行のままだと行が 300px で止まり、
            本文の幅に対して右が大きく余る (`TaglineLines` の `flow` を参照)。
          */}
          <TaglineLines lines={profile.tagline} className="author-note-tagline p-note" flow />

          <div className="author-note-links">
            {profile.socials.length > 0 && (
              <SocialLinks
                links={profile.socials}
                className="author-note-socials"
                linkClassName="author-note-social press-control"
              />
            )}
            {/* 区画の名前は訳さない (product.md「見える名前は訳さない」)。 */}
            <Link className="author-note-more press-control" to="/about">
              {t("navigation.about")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
