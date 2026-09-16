import CharacterSvg from "~/frontend/assets/yantene-character.svg?react";
import LogotypeSvg from "~/frontend/assets/yantene-logotype.svg?react";
import { LOGO_CHARACTER, LOGO_LOGOTYPE, LOGO_VIEW_BOX } from "~/lib/logo-layout";

type LogoProps = React.ComponentProps<"svg">;

/**
 * ロゴ。歩くやんてねくんと「やんてね」の字形を横に並べたもの。
 *
 * **合成済みの 1 枚は持たない。** 素材 2 つを入れ子の `<svg>` として並べるだけで、絵の
 * 在り処はそれぞれ 1 つになる。写しを持っていたときは、キャラクターを描き直した回に
 * ヘッダーと OG カードだけが旧い姿で取り残された ([#527](https://github.com/yantene/yantene.net/issues/527))。
 *
 * 入れ子の `<svg>` にしているのは、置き場所を `x` / `y` / `width` / `height` だけで
 * 書けるため。`<g transform>` で包むと、素材の viewBox と倍率を自分で掛け合わせることに
 * なり、素材を差し替えたときに合わせ直す数が増える。
 *
 * 塗りは `currentColor` のまま通す。呼ぶ側の `color` がそのままインクになる
 * (素材 2 つとも同じ契約で、白の裏打ちだけが自前の色を持つ)。
 */
export function Logo({ className, ...props }: LogoProps): React.JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${String(LOGO_VIEW_BOX.width)} ${String(LOGO_VIEW_BOX.height)}`}
      fill="currentColor"
      className={className}
      {...props}
    >
      <CharacterSvg {...LOGO_CHARACTER} />
      <LogotypeSvg {...LOGO_LOGOTYPE} />
    </svg>
  );
}
