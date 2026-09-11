/**
 * 記事をどこまで読んだかを示す、画面上端の細い帯。
 *
 * 進み具合の計算も描画も CSS が持つ (reading-progress.css)。ここが持つのは入れ物だけで、
 * props も状態も無い。スクロール量を JS で読んで幅に流す作りにしないのは、規約 (
 * `.claude/rules/architecture.md`) が連続値を `style` 属性へ書き込むことを禁じており、
 * かつ CSS の scroll-driven animation で同じものが JS 無しに書けるため。
 *
 * 目には出るが読み上げには出さない。伝えているのはスクロール位置という、支援技術が
 * 自前でもっと確かに伝えられる情報で、読み上げに足しても繰り返しが増えるだけになる。
 */
export function ReadingProgress(): React.JSX.Element {
  return (
    <div className="reading-progress" aria-hidden="true">
      <span className="reading-progress-bar" />
    </div>
  );
}
