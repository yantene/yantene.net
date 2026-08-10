# 0008. 時間の表現を Web Animations API で操作可能にする

- Status: Accepted
- Date: 2026-08-09
- Deciders: @yantene

## Context / 背景

トップページの Celestim (CSS だけで書かれた天体アニメーション) は、ヒーロー下部に時刻の
目盛りを置き、それを掴んで左右に引くと空・太陽・月・雲がまとめて進退する。何日ぶんでも
進められるので、月の満ち欠けが変わり、やがて日食にも行き当たる。

ここで CSP と正面からぶつかる。このサイトは `style-src 'self'` を維持しており、
inline style は本番で丸ごと無視される ([0007](0007-strict-csp-outside-development.md))。
規約も「見た目の可変軸は静的な CSS のクラスの段階として持つ」と定めている。ところが
ドラッグは本質的に連続値であり、「段階」では表現できない。

さらに、Celestim には守るべき不変条件がある。太陽と月の離角、月相、空の色は互いに
独立ではなく、同じ時刻から導かれる別表現になっている。月相だけを進めると「太陽に重なった
満月」という起こりえない状態になる。時間を動かす手段は、この整合を壊さないものでなければ
ならない。

## 検討した選択肢

- **案 A: CSSOM 経由で CSS 変数を更新する** — `celestim.css` の各 `animation-delay` に
  スクラブ量の変数を組み込み、JS から `setProperty` で書き換える。
  - Pros: CSS を読めばスクラブの存在が分かる。`setProperty` は style 属性のパースを
    伴わないので CSP に抵触しない。
  - Cons: 天体ごとに異なる `animation-delay` の式すべてに変数を撒く必要があり、
    月相の計算式が一段と読みにくくなる。一時停止中に `animation-delay` を変えたときの
    振る舞いがブラウザ間で保証されておらず、`prefers-reduced-motion` と組み合わせたときに
    不確実性が残る。
- **案 B: SVG の presentation attribute に作り直す** — 太陽・月を SVG で描き直し、
  `transform` / `cx` 属性で位置を決める。
  - Pros: presentation attribute は style 属性ではないので CSP の対象外。SSR でもそのまま効く。
  - Cons: Celestim を一から書き直すことになる。とりわけ、空と同色で塗った影を重ねて
    月の満ち欠けと日食を作っている実装は、素直には移植できない。
- **案 C: Web Animations API で `currentTime` を動かす** — CSS アニメーションはそのままに、
  JS からアニメーションオブジェクトの再生位置を進める。
  - Pros: `celestim.css` に手を入れずに済む。style 属性も CSS 変数も経由しないので、
    CSP との衝突が発生する余地そのものが無い。
  - Cons: 対象のアニメーションを名前で集めるため、CSS 側で keyframes 名を変えると
    静かに追随しなくなる。

## 決定

案 C を採る。空・太陽・月・月相・雲・目盛りを、すべて「1 日の長さ (`--day-cycle`) を基準にした
`linear infinite` の CSS アニメーション」として定義し、JS はそれらの `currentTime` に
同じ増分を与えるだけにする。

決め手は整合の保ちやすさだった。全部が同じ document timeline の上にあるので、同じ量だけ
ずらせば離角も月相も自動的に揃う。これは `celestim.css` が「時計を 14 日進める」という
1 つの操作で満月から始めているのと同じ理屈を、連続値に広げたものになっている。

`currentTime` は再生中でも一時停止中でも読み書きでき、再生中に代入しても走ったまま位相だけ
飛ぶ。そのため `prefers-reduced-motion` で自動進行を止めた状態でも、同じコードで操作できる。

あわせて、より一般的な原則をここに記しておく。**CSP の下で連続的な見た目を与える手段は、
Web Animations API か SVG の presentation attribute であって、style 属性ではない。**
規約が「静的な CSS のクラスの段階で持て」と言っているのは、style 属性が消えることへの
対処であり、連続値そのものを禁じているわけではない。段階で表せない軸に出会ったら、
まずこの 2 つを検討する。

## 帰結 / Consequences

- 良い面: `celestim.css` は 1 日の長さを外から受け取る 1 行の変更だけで済み、天体の計算式は
  元のまま残った。JS が無い環境では掴めなくなるだけで、時計は変わらず流れ続ける
  (プログレッシブエンハンスメント)。ヒーローで時間を進めると、同じ名前のアニメーションを
  持つフッターの色帯も一緒に動く。
- 悪い面・トレードオフ: 時計に属するアニメーションを keyframes 名の一覧
  (`day-clock.ts` の `clockAnimationNames`) で管理している。CSS 側で名前を変えたときに
  型検査では捕まらず、その要素だけ時間が進まなくなる。名前を変えるときは必ず両方を直すこと。
  また、日をまたいだ回数は画面のどこにも表示していない。何日目にいるかは月の満ち欠けからしか
  読み取れない。
- 検証方法 / 今後の宣言: 時刻と位置の相互変換は `time-axis.ts` に純粋関数として切り出し、
  `time-axis.test.ts` が固定している。WAAPI の挙動そのものはブラウザ上でしか確かめられないため、
  実装時は `pnpm run preview:staging` で CSP を有効にした状態で、目盛りを掴んで空が動くことを
  確認する。dev では CSP が付かないので、この確認にはならない
  ([0007](0007-strict-csp-outside-development.md))。

## 参考 / More Information

- [0007](0007-strict-csp-outside-development.md) — CSP の方針と適用範囲
- Issue [#101](https://github.com/yantene/yantene.net/issues/101) — トップページとヘッダーの UI 刷新
