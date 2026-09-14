import { useTranslation } from "react-i18next";
import { formatPlainDate } from "./plain-date";
import type { PublicProfile } from "~/backend/handlers/profile/profile-view";
import { SocialLinks, toDisplaySocialLinks } from "~/frontend/components/social/social-links";

/** 顔。近影ではなくやんてねくんのアイコンを出す (#413 の続きで差し替える)。 */
const AVATAR_SRC = "/icons/icon-192.png";
const AVATAR_SIZE = 192;

interface ProfileCardProps {
  readonly profile: PublicProfile;
}

/**
 * プロフィールの名乗り。顔・名前・短い自己紹介・生い立ち・出ていく先。
 *
 * **ここに置く `h-card` は代表 h-card ではない。** 代表はトップのヒーローにあり
 * (Bridgy Fed が「誰のサイトか」を読む印)、こちらは同じ人を指す別の h-card になる。
 * 代表を 2 つ置くとどちらを読むかが決まらなくなるので、移さないこと。
 *
 * 出身地に microformats の印は付けない。h-card に生まれた場所を表す語が無く、
 * 近い名前 (`p-locality`) を流用すると「いま住んでいる街」として読まれるため。
 * 機械に渡すのは JSON-LD の `birthPlace` のほうに任せる。
 */
export function ProfileCard({ profile }: ProfileCardProps): React.JSX.Element {
  const { t, i18n } = useTranslation();

  return (
    <header className="profile-card h-card">
      {/*
        顔は読み上げに出さない (alt を空にする)。隣に名前が字で出ているので、
        読み上げると同じ名前が 2 回続く。
      */}
      <img
        className="profile-avatar u-photo"
        src={AVATAR_SRC}
        alt=""
        width={AVATAR_SIZE}
        height={AVATAR_SIZE}
        fetchPriority="high"
        decoding="async"
      />
      <div className="profile-identity">
        <h1 className="profile-name p-name">{profile.name}</h1>
        {/*
          短い自己紹介は書いたとおりの行で出す。**段落に畳まない。**
          行の長さを揃えて書いてあるので、繋げると意図した切れ目が消える。

          折るのは CSS (`white-space: pre-line`) に任せ、行ごとの要素は作らない。
          `<br>` や `<span>` を挟むと、`p-note` を読んだパーサに渡る字が行ごとに
          割れる (h-card の自己紹介は 1 つの文字列であってほしい)。
        */}
        <p className="profile-tagline p-note">{profile.tagline}</p>

        <dl className="profile-facts">
          <dt className="profile-facts-label">{t("profile.dateOfBirth")}</dt>
          <dd className="profile-facts-value">
            <time className="dt-bday" dateTime={profile.dateOfBirth}>
              {formatPlainDate(profile.dateOfBirth, i18n.language)}
            </time>
          </dd>
          {profile.birthplace !== null && (
            <>
              <dt className="profile-facts-label">{t("profile.birthplace")}</dt>
              <dd className="profile-facts-value">{profile.birthplace}</dd>
            </>
          )}
        </dl>

        {/*
          出ていく先は `profile.md` の並びをそのまま出す。絵の表だけがコードにある。
          `u-url` を添えるのは、この h-card がその人を指す先として読まれるため。
        */}
        {profile.socials.length > 0 && (
          <SocialLinks
            className="profile-socials"
            linkClassName="profile-social press-control u-url"
            links={toDisplaySocialLinks(profile.socials)}
          />
        )}
      </div>
    </header>
  );
}
