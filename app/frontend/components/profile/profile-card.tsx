import type { PublicProfile } from "~/backend/handlers/profile/profile-view";
import { TaglineLines } from "./tagline-lines";
import { PROFILE_PHOTO } from "~/lib/profile-fallback";
import { SocialLinks } from "~/frontend/components/social/social-links";

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
 * 顔はサイトのアイコン (`PROFILE_PHOTO`)。**書き手が選ぶ欄は無い。**
 * `alt` を空にしてあるのは、すぐ隣に同じことを言う名前があるため (読み上げで 2 回
 * 名乗ることになる)。
 *
 * **生い立ちの欄は置かない。** 生年月日や出身地を並べると名乗りが表になり、顔・名前・
 * 短い自己紹介という主役が押される。そういう話は本文の地の文で書く (#508)。
 *
 * **画面の幅によらず中央に積む。** 顔を左に置いて字を右へ流すと、下に続く本文が欄の
 * 左端から始まるのに対して名乗りだけが右に寄って見える。名乗りは本文の一部ではなく
 * 頭に載せる札なので、本文の流れから外して左右対称に置く。
 */
export function ProfileCard({ profile }: ProfileCardProps): React.JSX.Element {
  return (
    <div className="h-card flex flex-col items-center gap-6 text-center">
      <img
        className="u-photo size-28 shrink-0 rounded-full border border-border/60 object-cover"
        src={PROFILE_PHOTO}
        alt=""
      />

      <div className="flex flex-col items-center gap-4">
        <h1 className="p-name text-2xl font-semibold tracking-tight">{profile.name}</h1>

        {/*
          器を 2xl まで広げるのは、書かれた改行のまま出すため。中央揃えの字は、
          行の途中で折り返すと軸が二重に見えて読みにくい。名乗りの器 (3xl) から
          左右の余白を引いた幅には収まる。
        */}
        <TaglineLines
          lines={profile.tagline}
          className="p-note max-w-2xl text-[0.95rem] leading-relaxed text-foreground/85"
        />

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
            className="flex items-center gap-3"
            linkClassName="press-control text-2xl"
          />
        )}
      </div>
    </div>
  );
}
