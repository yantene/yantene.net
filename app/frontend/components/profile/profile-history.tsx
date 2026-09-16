import { HiArrowTopRightOnSquare } from "react-icons/hi2";
import type { PublicHistoryChapter } from "~/backend/handlers/profile/profile-view";

interface ProfileHistoryProps {
  readonly history: readonly PublicHistoryChapter[];
}

type HistoryEntryView = PublicHistoryChapter["entries"][number];

function keyOf(entry: HistoryEntryView): string {
  return [entry.year, entry.month ?? "", entry.text, entry.url ?? "", entry.note ?? ""].join(
    "\u0000",
  );
}

/**
 * 札の字。月まで書いてあれば `2012-04`、無ければ `2012`。
 *
 * 記事の年表の `MM-DD` と同じ区切りにする。**混ざるのは承知の上** — 月を覚えている
 * 出来事と、そうでない出来事が並ぶ。埋めさせるより、書けるものだけ書けるほうがよい。
 */
function stampOf(entry: HistoryEntryView): string {
  const year = String(entry.year);
  if (entry.month === null) return year;
  return `${year}-${String(entry.month).padStart(2, "0")}`;
}

/**
 * 経歴を章ごとに束ねた縦の年表。`/about` の末尾だけが描く。
 *
 * 見た目の語彙 (左の柱・点・縦の罫線) は記事の年表 (`article-timeline`) と共有するが、
 * **コンポーネントは分けてある**。あちらは記事 1 本を前提にした器で、スラグ・公開日・
 * 要約・サムネイル・`h-feed` / `h-entry` を持つ。経歴にはどれも無く、出来事に
 * `h-entry` を付けるのは意味論的に嘘になる。
 *
 * ⚠️ **microformats の印を付けないこと** (ADR 0044)。ここは h-card の中でも h-entry の
 * 中でもない。`dt-*` を足すと、生年月日を機械が読む形で持たないという線引き (#508) が
 * 経歴の側から崩れる。`profile-history.mf2.test.tsx` が見張っている。
 *
 * 束ねるのは暦年ではなく章 (高校・大学・社会人)。区切りは書き手が決めるので、
 * ここでは渡された順のまま出す (並べ替えない)。
 */
export function ProfileHistory({ history }: ProfileHistoryProps): React.JSX.Element {
  return (
    <div className="profile-history">
      {history.map((chapter) => (
        <div key={chapter.chapter} className="profile-history-chapter">
          {/*
            章の名前は見出しにする。記事の年表が年を見出しにしないのは、日付が各項目の
            time 要素に残っていて読み上げに要らないため。**章はどの項目にも書いていない**
            ので、見出しにしないと読み上げた人がどの束を聞いているのか分からない。
            段は h3 (節の題「History」が h2 で、`WorkList` の作品名と同じ位置)。
          */}
          <h3 className="profile-history-chapter-name">{chapter.chapter}</h3>
          <ol className="profile-history-list">
            {chapter.entries.map((entry) => (
              /*
                鍵は欄をすべて繋いだもの。**年と字だけでは足りない** — 同じ年に同じ字の
                出来事を、補足やリンクだけ変えて 2 つ書ける (VO が見るのは各欄の妥当さで、
                重複ではない)。全部の欄が同じなら見た目も同じになるので、そこで衝突しても
                取り違えようが無い。
              */
              <li key={keyOf(entry)} className="profile-history-item">
                {/* 点は線の上の駅を表す装飾で、年は隣の字が持っている。 */}
                <span className="profile-history-dot" aria-hidden="true" />
                {/*
                  `time` は使わない。経歴は読み物として出すもので、機械に名乗る身元の
                  一部ではない (ADR 0044)。`2012-04` は `time` の datetime として通る
                  書式だが、通ることと持たせることは別。
                */}
                <span className="profile-history-year">{stampOf(entry)}</span>

                <div className="profile-history-body">
                  <p className="profile-history-text">
                    {entry.url === null ? (
                      entry.text
                    ) : (
                      <a
                        href={entry.url}
                        className="press-control group inline transition-colors hover:text-primary"
                      >
                        {/*
                          絵は行き先が外であることの印で、名前は隣の字が持っている。

                          ⚠️ **字の前に置く。** 後ろに置くと、狭い画面で絵だけが次の行に
                          取り残される (#522)。WORD JOINER を挟んでも止まらない — Chrome は
                          atomic inline (inline-block の中の SVG) の直前では、WJ があっても
                          折る。実機で確かめた。**リンクは段落の先頭から始まる**ので、
                          前に置けば取り残されようがない (`WorkList` と同じ置き方)。
                        */}
                        <span
                          className="profile-history-external mr-1 align-baseline text-base-content/40 transition-colors group-hover:text-primary"
                          aria-hidden="true"
                        >
                          <HiArrowTopRightOnSquare />
                        </span>
                        {entry.text}
                      </a>
                    )}
                  </p>

                  {entry.note !== null && <p className="profile-history-note">{entry.note}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
