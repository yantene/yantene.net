import { HiArrowRight, HiArrowTopRightOnSquare } from "react-icons/hi2";
import { Link } from "react-router";
import type { PublicWork } from "~/backend/handlers/works/work-view";
import { displayUrl } from "./display-url";

interface WorkListProps {
  readonly works: readonly PublicWork[];
}

/**
 * 作ったものの並び。`/works` と `/about` の両方がこれを描く。
 *
 * 書き写さず 1 つを共有するのは、2 か所で同じものを違う姿で出さないため。片方だけに
 * 在り処のリンクが付いている、のような食い違いは、見比べられる場所にあると目に付く。
 *
 * **項目全体を押し場所にしない。** 1 件につき行き先が 2 つある (詳しい説明と、作品
 * そのもの) ので、面で受けるとどちらへ行くのか決められない。名前が `/works/<slug>` へ、
 * 在り処の行が外へ向かう。
 */
export function WorkList({ works }: WorkListProps): React.JSX.Element {
  return (
    <ul className="work-list">
      {works.map((work) => (
        <li key={work.slug} className="work-list-item">
          <h3 className="work-list-name">
            <Link
              to={`/works/${work.slug}`}
              className="press-control group inline-flex items-center gap-1.5 transition-colors hover:text-primary"
            >
              {work.name}
              <span
                className="text-sm text-base-content/40 transition-colors group-hover:text-primary"
                aria-hidden="true"
              >
                <HiArrowRight />
              </span>
            </Link>
          </h3>

          <p className="work-list-summary">{work.summary}</p>

          {work.url !== null && (
            <a
              href={work.url}
              className="work-list-url press-control inline-flex items-center gap-1.5 transition-colors hover:text-primary"
            >
              {/*
                絵は行き先が外であることの印で、名前は隣の字が持っている。読み上げから
                外さないと、リンクの名前が「外部リンク github.com/...」と重なる。
              */}
              <span aria-hidden="true">
                <HiArrowTopRightOnSquare />
              </span>
              {displayUrl(work.url)}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
