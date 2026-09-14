import { useTranslation } from "react-i18next";
import type { PublicProfile } from "~/backend/handlers/profile/profile-view";
import { TaglineLines } from "./tagline-lines";
import { SocialLinks } from "~/frontend/components/social/social-links";
import { toDisplayDate } from "~/frontend/lib/display-date";

interface ProfileCardProps {
  readonly profile: PublicProfile;
}

/**
 * `/about` の頭に出す書き手の紹介。
 *
 * ここも h-card だが、**代表 h-card はトップのヒーローのまま**。同じ人を指す別の
 * h-card が 2 か所にあるのは microformats2 として正しい姿で、「このサイトの代表は
 * 誰か」を答えるのがトップに 1 つだけあればよい。
 *
 * 顔写真は見える形で出す。`alt` を空にしてあるのは、すぐ隣に同じことを言う名前が
 * あるため (読み上げで 2 回名乗ることになる)。
 *
 * 生い立ち (生年月日・出身地) は書いてあるものだけ出す。**空の欄は置かない。**
 * ラベルだけがあって値の無い行は、読み手には「知らされていない」ではなく「壊れている」
 * ように見える。
 */
export function ProfileCard({ profile }: ProfileCardProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="h-card flex flex-col items-center gap-6 text-center sm:flex-row sm:items-start sm:text-left">
      {profile.avatarUrl !== null && (
        <img
          className="u-photo size-28 shrink-0 rounded-full border border-border/60 object-cover"
          src={profile.avatarUrl}
          alt=""
        />
      )}

      <div className="flex flex-col items-center gap-4 sm:items-start">
        <h1 className="p-name text-2xl font-semibold tracking-tight">{profile.name}</h1>

        <TaglineLines
          lines={profile.tagline}
          className="p-note max-w-xl text-[0.95rem] leading-relaxed text-foreground/85"
        />

        {/*
          生い立ち。ラベルと値を 2 列に並べる。

          狭い画面でも 2 列のままにするのは、項目が 2 つしかなく、ラベルが短いため
          (積むと縦に 4 行になって、名乗りより背が高くなる)。
        */}
        {(profile.dateOfBirth !== null || profile.birthplace !== null) && (
          <dl className="grid grid-cols-[auto_auto] justify-center gap-x-4 gap-y-1 text-sm sm:justify-start">
            {profile.dateOfBirth !== null && (
              <>
                <dt className="text-left text-muted-foreground">{t("profile.dateOfBirth")}</dt>
                <dd className="text-left tabular-nums">
                  {/*
                    機械には書かれたままの日付を、人にはサイト共通の書式で渡す
                    (記事の日付と揃える)。
                  */}
                  <time className="dt-bday" dateTime={profile.dateOfBirth}>
                    {toDisplayDate(profile.dateOfBirth)}
                  </time>
                </dd>
              </>
            )}
            {profile.birthplace !== null && (
              <>
                <dt className="text-left text-muted-foreground">{t("profile.birthplace")}</dt>
                {/*
                  出身地に microformats の印は付けない。h-card に生まれた場所を表す語が
                  無く、近い名前 (`p-locality`) を流用すると「いま住んでいる街」として
                  読まれる。機械に渡すのは JSON-LD の `birthPlace` に任せる。
                */}
                <dd className="text-left">{profile.birthplace}</dd>
              </>
            )}
          </dl>
        )}

        {/*
          機械に読ませるためだけの、サイト自身への参照。見える形の対応物がこの紹介に
          無いので、印だけを置く。`aria-hidden` と `tabIndex={-1}` は必ず対で置くこと
          (sr-only だけではタブ順に残り、見えないリンクに焦点が止まる。#287)。
        */}
        <a className="sr-only u-url" href="/" aria-hidden="true" tabIndex={-1}>
          yantene.net
        </a>

        {profile.socials.length > 0 && (
          <SocialLinks
            links={profile.socials}
            className="flex items-center gap-5"
            linkClassName="press-control inline-flex text-2xl text-foreground/85 transition-colors hover:text-primary"
          />
        )}
      </div>
    </div>
  );
}
