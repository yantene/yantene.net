import { useTranslation } from "react-i18next";
import type { PublicWork } from "~/backend/handlers/works/work-view";
import { spanStamp } from "~/lib/date-span";

interface WorkFactsProps {
  readonly work: Pick<PublicWork, "stack" | "period" | "role">;
}

/**
 * 作品の諸元 (使った技術・時期・役割)。`/works/<slug>` の名前と概要の下に出る。
 *
 * **どの欄も省略できる。** 書いていない欄は行ごと出さず、3 つとも無ければ何も描かない
 * (空の器も罫線も残さない)。
 *
 * 欄の名前 (Stack / Period / Role) は訳さない。区画の名前なので、日本語モードでも
 * 英語のまま出す (`locales.test.ts`)。
 *
 * 時期は `time` にしない。精度が 3 段あり (`2024` だけのこともある)、終わりも持つので、
 * 1 つの日時として機械に名乗れる形をしていない (経歴の年表と同じ扱い)。
 */
export function WorkFacts({ work }: WorkFactsProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const { stack, period, role } = work;

  if (stack.length === 0 && period === null && role === null) return null;

  return (
    <dl className="work-facts">
      {stack.length > 0 && (
        <div className="work-facts-row">
          <dt className="work-facts-name">{t("works.stack")}</dt>
          <dd>
            <ul className="work-facts-stack">
              {stack.map((item) => (
                <li key={item} className="work-facts-tag">
                  {item}
                </li>
              ))}
            </ul>
          </dd>
        </div>
      )}
      {period !== null && (
        <div className="work-facts-row">
          <dt className="work-facts-name">{t("works.period")}</dt>
          <dd className="work-facts-period">{spanStamp(period.from, period.until)}</dd>
        </div>
      )}
      {role !== null && (
        <div className="work-facts-row">
          <dt className="work-facts-name">{t("works.role")}</dt>
          <dd>{role}</dd>
        </div>
      )}
    </dl>
  );
}
