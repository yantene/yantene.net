import type { PublicProfile } from "~/backend/handlers/profile/profile-view";
import { TaglineLines } from "./tagline-lines";
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
 * 顔写真は見える形で出す。`alt` を空にしてあるのは、すぐ隣に同じことを言う名前が
 * あるため (読み上げで 2 回名乗ることになる)。
 */
export function ProfileCard({ profile }: ProfileCardProps): React.JSX.Element {
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
