import type { PublicWorkScreenshot } from "~/backend/handlers/works/work-view";
import { LightboxImage } from "~/frontend/components/mdast/lightbox-image";

interface WorkGalleryProps {
  readonly screenshots: readonly PublicWorkScreenshot[];
  /** 並びの名前。画面には出ず、読み上げにだけ出る。 */
  readonly label: string;
}

/**
 * 枠の比率。**連続値ではなく段階のクラスで持つ** (inline style を書かない決まり)。
 *
 * 横長のデスクトップ画面と縦長のスマートフォン画面を同じ枠に入れると、どちらかが
 * 小さくなる。高さを揃えて幅のほうを変える。
 */
const frameClasses = {
  desktop: "work-gallery-desktop",
  mobile: "work-gallery-mobile",
} as const satisfies Record<PublicWorkScreenshot["kind"], string>;

/**
 * 作品のスクリーンショットの並び。`/works/<slug>` の頭に出る。
 *
 * 横に流して、はみ出した分は横スクロールで送る。縦に積むと、3 枚あるだけで名前と概要が
 * 画面の外へ押し出される。
 *
 * 拡大は記事の画像と同じ器 (`LightboxImage`) を使う。押すと暗幕の上に全体が出る。
 * 枠の中では上端に寄せて切るので、縦に長い画面は拡大して初めて全部が見える。
 *
 * **枠の大きさは画像を待たずに決まる** (高さは CSS、幅は比率のクラス)。画像の
 * width / height も添えるが、こちらは枠ではなく `<img>` 自身の持ち分で、読み込みの前後で
 * ページが動かないことは枠が保証している。
 *
 * 1 枚も無ければ何も描かない (空の器を残さない)。
 */
export function WorkGallery({ screenshots, label }: WorkGalleryProps): React.JSX.Element | null {
  if (screenshots.length === 0) return null;

  return (
    <ul className="work-gallery" aria-label={label}>
      {screenshots.map((screenshot, index) => (
        <li key={screenshot.src} className={`work-gallery-frame ${frameClasses[screenshot.kind]}`}>
          <LightboxImage
            className="work-gallery-image"
            src={screenshot.src}
            alt={screenshot.alt}
            {...(screenshot.width === null || screenshot.height === null
              ? {}
              : { width: screenshot.width, height: screenshot.height })}
            // 1 枚目はページの頭に出るので待たせない。残りは横に送るまで見えない。
            loading={index === 0 ? "eager" : "lazy"}
            decoding="async"
          />
        </li>
      ))}
    </ul>
  );
}
