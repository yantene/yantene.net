import { HiArrowTopRightOnSquare, HiChevronDown } from "react-icons/hi2";
import type { PublicHistoryChapter } from "~/backend/handlers/profile/profile-view";

interface ProfileHistoryProps {
  readonly history: readonly PublicHistoryChapter[];
}

type HistoryEntryView = PublicHistoryChapter["entries"][number];

function keyOf(entry: HistoryEntryView): string {
  return [
    entry.date,
    entry.until ?? "",
    entry.text,
    entry.url ?? "",
    entry.note ?? "",
    String(entry.important),
  ].join("\u0000");
}

/**
 * 札の字。
 *
 * 点の出来事はそのまま (`2011` / `2011-06` / `2011-06-04`)。終わりがあるときは
 * **始まりと重なる位を畳んで**出す。
 *
 * | 始まり     | 終わり     | 札                      |
 * | ---------- | ---------- | ----------------------- |
 * | 2012-08-14 | 2012-08-18 | `2012-08-14 〜 18`      |
 * | 2012-08-14 | 2012-09-02 | `2012-08-14 〜 09-02`   |
 * | 2012-12-28 | 2013-01-03 | `2012-12-28 〜 2013-01-03` |
 * | 2011       | 2013       | `2011 〜 2013`          |
 *
 * 畳まずに両端を書くと、5 日間の合宿の札が 24 字になって本文より目立つ。**最後の位は
 * 必ず残す** (`2012-08-14 〜 ` のような尻切れを作らない)。
 */
function stampOf(entry: HistoryEntryView): string {
  if (entry.until === null) return entry.date;

  const from = entry.date.split("-");
  const to = entry.until.split("-");
  // 始まりと違いの出る最初の位。精度は同じなので、必ずどこかで違う。
  const differs = from.findIndex((part, index) => part !== to[index]);
  const keepFrom = differs === -1 ? from.length - 1 : differs;

  return `${entry.date} 〜 ${to.slice(keepFrom).join("-")}`;
}

/**
 * 畳んだ章でも出す出来事か。**章の最初と最後は必ず出し**、その間は重要の印で決める。
 *
 * 最初と最後を残すのは、畳んだ姿からでもその章がいつからいつまでかが読めるようにする
 * ため。重要な出来事が 1 つも無い章も、両端の 2 件で中身の見当が付く。
 */
function isKeptWhenFolded(entries: readonly HistoryEntryView[], index: number): boolean {
  return index === 0 || index === entries.length - 1 || entries[index]?.important;
}

/**
 * 畳んだ章で `⋮` を置く位置。**畳むと隠れる出来事が続く束の頭**ごとに 1 つ。
 *
 * 残す出来事の間に挟まった束は、それぞれの位置に `⋮` が立つ。1 つにまとめると、
 * どこを省いたのかが分からなくなる。
 */
function startsGap(entries: readonly HistoryEntryView[], index: number): boolean {
  if (isKeptWhenFolded(entries, index)) return false;
  return isKeptWhenFolded(entries, index - 1);
}

/**
 * 経歴を章ごとに束ねた縦の年表。`/about` の名乗りの直下だけが描く。
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
 *
 * **章は畳んだ姿で出る** (ADR 0045)。畳んでいる間に出るのは、章の最初と最後と、
 * 重要の印 (`important`) の付いた出来事だけで、省いたところには `⋮` が立つ。
 * 章の名前を押すと全部が出る。
 */
export function ProfileHistory({ history }: ProfileHistoryProps): React.JSX.Element {
  return (
    <div className="profile-history">
      {history.map((chapter) => (
        <div key={chapter.chapter} className="profile-history-chapter">
          {/*
            開閉の器は `<details>`。**中身は空で、開いているかどうかだけを持つ。** 出来事の
            列は隣の `<ol>` にあり、どれを隠すかは CSS が `:has([open])` で決める。
            `<details>` の中に列を入れると、畳んだ間は重要な出来事まで隠れてしまう。

            JavaScript は要らない (ヘッダーのメニューと同じ器)。

            章の名前は見出しにする。**章はどの項目にも書いていない**ので、見出しにしないと
            読み上げた人がどの束を聞いているのか分からない。段は h3 (節の題「History」が
            h2)。`<summary>` の中の見出しはボタンに畳まれて見出しとしては読まれない
            読み上げ環境もあるが、そのときもボタンの名前が章の名前になるので、どの束かは
            伝わる。
          */}
          <details className="profile-history-toggle">
            <summary className="profile-history-summary press-control">
              <h3 className="profile-history-chapter-name">{chapter.chapter}</h3>
              <HiChevronDown className="profile-history-caret" aria-hidden />
            </summary>
          </details>
          <ol className="profile-history-list">
            {chapter.entries.flatMap((entry, index) => [
              ...(startsGap(chapter.entries, index)
                ? [
                    /*
                      省いた束の印。畳んでいる間だけ出る。読み上げには出さない (隠れた
                      出来事は読み上げからも外れていて、開けば全部が読める)。
                    */
                    <li key={`gap:${keyOf(entry)}`} className="profile-history-gap" aria-hidden>
                      ⋮
                    </li>,
                  ]
                : []),
              /*
                鍵は欄をすべて繋いだもの。**年と字だけでは足りない** — 同じ年に同じ字の
                出来事を、補足やリンクだけ変えて 2 つ書ける (VO が見るのは各欄の妥当さで、
                重複ではない)。全部の欄が同じなら見た目も同じになるので、そこで衝突しても
                取り違えようが無い。
              */
              <li
                key={keyOf(entry)}
                className={`profile-history-item${isKeptWhenFolded(chapter.entries, index) ? " profile-history-kept" : ""}`}
              >
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
              </li>,
            ])}
          </ol>
        </div>
      ))}
    </div>
  );
}
