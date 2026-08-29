/**
 * 読まれた回数から「いま人気のノート」の順位を出す。
 *
 * 単純な累計では、古くからある記事がいつまでも上位に居座り、順位が動かなくなる。
 * そこで 1 回のアクセスの重みを、新しいものほど大きくする。基準日からの経過が半減期
 * 1 つぶん進むごとに、そのとき起きたアクセスの重みは 2 倍になる。古い重みを減らす
 * のではなく新しい重みを増やすので、記録済みの値には二度と触らなくてよい。
 *
 * 結果として古い記事が上位に来ることはある。それは「昔の記事がいまも読まれている」
 * ということなので正しい。公開日の順に並べているわけではない。
 *
 * ## なぜ対数で持つのか
 *
 * 重みは経過に対して指数的に膨らむので、素の値で持つと倍精度でも 85 年ほどで溢れる
 * (半減期 30 日の場合)。対数のまま持てば経過に対して線形にしか増えず、100 万年でも
 * 8.4e6 にしかならない。
 *
 * 対数は単調なので、順序は素の値のときと変わらない。保存した列をそのまま
 * `ORDER BY ... DESC` すれば人気順になり、読み出すときに計算を挟まなくて済む。
 *
 * ## 実際に足し引きするのは SQL の側
 *
 * 記録は「いまの値を読んで、足して、書き戻す」ではなく UPDATE 1 文で行う。2 手に分けると、
 * その間に別の閲覧やリアクションが挟まったときに片方の加算がまるごと消えるため。
 *
 * ここにある関数は順位付けの意味を決めている本体で、SQL の式 (infra/d1/view-log-score) が
 * これと同じ結果を出すことは infra 側のテストが突き合わせている。重み
 * (viewWeightLog / reactionWeightLog) は日付だけから決まる純粋な計算なので、呼び出し側が
 * ここで出して SQL に渡す。対数の組み立て方をインフラに持ち出さないための分け方。
 */

/**
 * 重みの基準となる日 (ISO 日付文字列 "YYYY-MM-DD", UTC)。
 *
 * この日に起きたアクセスの重みを 1 とし、以降は半減期ごとに 2 倍になる。全記事で
 * 同じ値を使う限り順序は変わらないので、値そのものに意味はない。どの記事の投稿日より
 * 前に置いてあるのは、投稿日を出発点の重みに使っており、それが負にならないようにするため。
 *
 * ただし **一度動かすと、記録済みのスコアと意味が食い違う**。過去に書いた値は古い
 * 基準で測られたままなので、動かすなら全記事のスコアを捨てること。
 */
export const VIEW_SCORE_EPOCH = "2000-01-01";

/**
 * 重みが 2 倍になるまでの日数 (＝古い側から見た半減期)。
 *
 * 短いほど直近の勢いを拾い、長いほど落ち着いた人気を映す。記事もアクセスも多くない
 * うちは短くすると数件の差で順位が跳ねるため、やや長めに取る。
 *
 * 基準日と同じく、動かすと記録済みの値と意味が食い違う。
 */
export const VIEW_SCORE_HALF_LIFE_DAYS = 30;

/**
 * その日に起きた 1 アクセスの重み (対数)。
 *
 * 基準日より前なら負になるが、それで構わない。対数の世界では 0 が「重み 1」であって、
 * 負は「1 より軽い」を意味するだけで、順序は保たれる。
 */
export function viewWeightLog(viewedOn: string): number {
  return (daysBetween(VIEW_SCORE_EPOCH, viewedOn) / VIEW_SCORE_HALF_LIFE_DAYS) * Math.LN2;
}

/**
 * リアクション 1 つが、閲覧何回ぶんの重みを持つか。
 *
 * 読むより強い意思表示なので重くする。対数の世界では倍率は足し算になるので、
 * この値の対数を重みに足すだけで済む。
 */
export const REACTION_WEIGHT_IN_VIEWS = 5;

/** リアクション 1 つの重み (対数)。 */
export function reactionWeightLog(reactedOn: string): number {
  return viewWeightLog(reactedOn) + Math.log(REACTION_WEIGHT_IN_VIEWS);
}

/**
 * 対数のまま 2 つを足す (log-sum-exp)。
 *
 * 大きいほうを括り出してから足すので、`Math.exp` の引数が 0 以下に収まり、
 * 途中の計算でも溢れない。
 */
function logAddExp(a: number, b: number): number {
  const larger = Math.max(a, b);
  const smaller = Math.min(a, b);
  return larger + Math.log1p(Math.exp(smaller - larger));
}

/**
 * 対数のまま引く (log-sub-exp)。log-sum-exp の裏返し。
 *
 * 引く側が引かれる側以上なら素の値が 0 以下になり、対数では表せない。-Infinity を返して
 * 呼び出し側に下限を決めさせる。
 */
function logSubExp(a: number, b: number): number {
  if (b >= a) return -Infinity;
  return a + Math.log1p(-Math.exp(b - a));
}

/**
 * 1 回読まれたあとのスコア (対数)。
 *
 * 出発点は投稿日の重み (viewWeightLog(publishedOn))。まだ読まれていないぶんを素の 0
 * とすると対数が -∞ になってしまうので、下限を「投稿日に 1 回読まれた」ぶんに引き上げて
 * ある。これで初回かどうかの場合分けが要らず、まだ読まれていない記事同士も新しい順に並ぶ。
 *
 * ただし出発点が順位を左右するのは、読まれた回数がごく少ないうちだけ。1 回でも読まれると
 * その重みが桁違いに大きく、出発点は丸めで消える。同点の決着は SQL 側の並び順に任せる。
 *
 * @param currentLogScore いまのスコア (まだ読まれていなければ 0)
 */
export function logScoreAfterView(currentLogScore: number, viewedOn: string): number {
  return logAddExp(currentLogScore, viewWeightLog(viewedOn));
}

/** リアクションが付いたあとのスコア (対数)。 */
export function logScoreAfterReaction(currentLogScore: number, reactedOn: string): number {
  return logAddExp(currentLogScore, reactionWeightLog(reactedOn));
}

/**
 * リアクションが外されたあとのスコア (対数)。
 *
 * 押したときに足したのと同じ値を引く。だから「いつ押したか」を覚えておく必要がある
 * (読み手のセッションが持つ)。押した日の重みではなく今日の重みを引くと、日をまたいで
 * 押し消しするだけでスコアを削れてしまう。
 *
 * 絵文字を別のものに差し替えるときは、ここを通さない。リアクションしている事実自体は
 * 続いているので、スコアは動かさず数だけを移す。今日の重みに付け替える形にすると、
 * 押し直すだけでスコアが上がる抜け道になる。
 *
 * ## 下限が要る理由
 *
 * 対数のまま足すと、桁が離れた小さいほうは丸めで消える。古い記事がまだ一度も
 * 読まれていない場合、スコアは投稿日の下駄だけで、そこに今日のリアクションを足すと
 * 下駄は倍精度の外に落ちる (重みの差が 37 桁ぶんを超えると exp が 0 に潰れる)。
 * 消えた値は引き戻せないので、引いた結果が下限を割ったら下限に戻す。
 *
 * @param floorLogScore 下限。この記事の出発点 (投稿日の重み) を渡す。
 */
export function logScoreAfterReactionRemoved(
  currentLogScore: number,
  reactedOn: string,
  floorLogScore: number,
): number {
  const removed = logSubExp(currentLogScore, reactionWeightLog(reactedOn));
  return Math.max(removed, floorLogScore);
}

const MILLISECONDS_PER_DAY = 86_400_000;

/** ISO 日付文字列 2 つの間隔を日数で返す (from が古いほど正の値)。 */
function daysBetween(from: string, to: string): number {
  const fromMs = Date.parse(`${from}T00:00:00Z`);
  const toMs = Date.parse(`${to}T00:00:00Z`);
  if (Number.isNaN(fromMs) || Number.isNaN(toMs)) {
    throw new RangeError(`invalid date: ${from} / ${to}`);
  }
  return (toMs - fromMs) / MILLISECONDS_PER_DAY;
}
