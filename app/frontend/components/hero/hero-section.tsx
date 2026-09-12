import { Celestim } from "./celestim";
import { Cityscape } from "./cityscape";
import { clockOriginClassName } from "./clock-origin";
import { TimeScrubber } from "./time-scrubber";
import type { ClockOrigin } from "./clock-origin";
import Logotype from "~/frontend/assets/yantene-logotype.svg?react";
import { SocialLinks } from "~/frontend/components/social/social-links";

interface HeroSectionProps {
  /**
   * 時計をどの時刻・どの月齢から始めるか。loader が決めた値を受け取る
   * (理由は clock-origin.ts に書いてある)。
   */
  readonly clockOrigin: ClockOrigin;
}

export function HeroSection({ clockOrigin }: HeroSectionProps): React.JSX.Element {
  return (
    /*
      開始位置は段階クラスで渡す。ここに載せたクラスは CSS 変数を差し替えるだけで、
      空・太陽・月・雲・目盛りが同じ量だけ進んだ状態から始まる。
    */
    <section
      className={`hero-clock ${clockOriginClassName(clockOrigin)} relative overflow-hidden border-b border-border/60`}
    >
      {/* 天体アニメの空 (Celestim)。文字を載せるので読みやすさ用のヴェールを有効にする。 */}
      <div className="absolute inset-0">
        <Celestim veil />
      </div>

      {/* 空の手前に街。テキストは街の線画に重なってよい (線が薄いので読める)。 */}
      <Cityscape />

      {/*
        ここがこのサイトの代表 h-card。**ホームページに 1 つだけ置く。**
        Bridgy Fed が「誰のサイトか」を読むのに最初に探す印で、これが無いと橋を架けられない。
      */}
      <div className="hero-intro h-card relative flex flex-col items-center gap-5 px-6 text-center">
        {/*
          見出しはロゴタイプの絵で出す。ヘッダーがキャラクターとロゴタイプを並べた一枚を
          使うのに対し、トップは字だけを大きく置き、キャラクターのほうは地平線を歩かせる
          (Daywalker)。同じ絵を 2 か所に出さないための分担。

          h-card の名前 (p-name) は機械が読む文字列なので、絵とは別に sr-only で置く。
          色は text-foreground から取る (素材の fill が currentColor)。
        */}
        <h1 className="inline-flex text-foreground">
          <Logotype className="h-12 w-auto sm:h-16" aria-hidden="true" />
          <span className="sr-only p-name">やんてね</span>
        </h1>

        {/*
          機械に読ませるためだけの、サイト自身への参照と顔。
          見える形の対応物がヒーローに無いので、印だけを置く。

          隠すのに `hidden` ではなく sr-only を使う。パーサが見えない要素を飛ばす作りだと
          印ごと消えるが、そうなっても気づけないため (壊れても何も言わずに橋が架からない)。
          顔は alt を空にしてあるので読み上げには出ない。

          リンクのほうは `aria-hidden` と `tabIndex={-1}` で人から隠す。sr-only だけでは
          タブ順に残り、見えないリンクにフォーカスが止まる (#287)。この 2 つは必ず対で
          置くこと。読み上げから消しただけの到達できる要素は、焦点が当たっても
          何も読まれない状態になる。
        */}
        <a className="sr-only u-url" href="/" aria-hidden="true" tabIndex={-1}>
          yantene.net
        </a>
        <img
          className="sr-only u-photo"
          src="/icons/icon-192.png"
          alt=""
          width={192}
          height={192}
        />

        {/*
          背後の光は控えめなので、文字も少しだけ透かして景色に馴染ませる。
          薄めすぎると夜側で沈むため、全周期で AA を満たす範囲に留めている。
        */}
        <p className="max-w-xl text-[0.95rem] leading-relaxed text-foreground/85">
          現実に屈しかけている自由ソフトウェア主義者^H^H^H愛好家です。
          <br />
          東京で Web 開発者をやっています。
          <br />
          ラップトップと、おいしいごはんと、あとは大切な人たちがいればだいたい幸せです。
        </p>

        {/* 表はヘッダーと共有する (components/social/social-links.tsx)。 */}
        <SocialLinks
          className="mt-1 flex items-center gap-5"
          linkClassName="press-control inline-flex text-2xl text-foreground/85 transition-colors hover:text-primary"
        />
      </div>

      {/* 地平線の上を歩く人と、掴んで時間を進められる目盛り。 */}
      <TimeScrubber initialMinutes={clockOrigin.minutesOfDay} />
    </section>
  );
}
