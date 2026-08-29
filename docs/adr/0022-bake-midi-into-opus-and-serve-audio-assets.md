# 0022. 曲は refresh 前に Opus へ焼いて配り、MIDI は原本として添える

- Status: Accepted
- Date: 2026-08-14
- Deciders: @yantene

## Context / 背景

2005 年から 2008 年にかけて書いていた個人サイトのバックアップから、記事をサルベージしている。
そこには当時「森のオルゴールメーカー」で作った MIDI が 5 本残っており、記事に載せて
鳴らしたい。当時のページは `<embed src="toiresinpulu.mid" autostart="true" loop="true">` で
鳴らしていた。

いまのこのサイトには、記事から音を出す手段がない。詰まっているのは 2 か所である。

- `app/backend/services/asset-content-type.ts` が返す Content-Type は画像 7 種
  (`png jpg jpeg gif webp avif svg`) だけで、それ以外は `application/octet-stream` になる
- `app/frontend/components/mdast/mdast-renderer.tsx` の `keepEmbedHtml` が、本文の生 HTML の
  うち `<iframe` を含むものだけを通して残りを捨てる。`<audio>` を書いても跡形もなく消える

塞がっていないところもある。`notes-refresh.service.ts` の `groupNotes` は `notes/<slug>/`
配下を拡張子で絞らずに拾い、`cacheAssets` は種別を問わず R2 に書く。
`readImageDimensions` は判別できなければ `undefined` を返し、呼び出し側が握る。
つまり音声ファイルを置くこと自体は、いまの実装でも壊れない。

そのうえで、本題は「MIDI をどう聴かせるか」である。**MIDI はブラウザで鳴らない。**
`<audio src="song.mid">` は Chrome / Firefox / Safari のいずれでも再生できない。ブラウザが
音源 (シンセと soundfont) を積んでいないためで、これは昔からずっとそうである。
かつて鳴っていたのは QuickTime や Windows Media Player のプラグインが `<embed>` を
横取りしていたからで、その経路は NPAPI ごと 2015 年に閉じた。

紛らわしいものに Web MIDI API (`navigator.requestMIDIAccess`) がある。Chrome 43 以降で
使えるが、用途は外部の MIDI 機器と喋ることであって、`.mid` を鳴らす機能ではない。音源は
含まれない。

## 検討した選択肢

- **案 A: MIDI をそのまま置いて `<audio>` に渡す** — 当時のファイルを無加工で配る。
  - Pros: 実装がほぼ要らない。原本そのもの。
  - Cons: **鳴らない。** 上記のとおり、どのブラウザにも音源が無い。
- **案 B: ブラウザで合成する** — html-midi-player / timidity の wasm 版 / SpessaSynth などを
  自ホストから配り、読者の端末で MIDI を鳴らす。
  - Pros: 原本をそのまま配れる。曲を差し替えても再変換が要らない。
  - Cons: soundfont を丸ごと配ることになり、20 秒の曲を鳴らすのに不相応に重い。
    音が使う soundfont 次第で変わるので、聴こえ方をこちらで決められない。
    そして**そもそも本文に書けない。** 生 HTML は iframe 以外を捨てるので web component の
    タグが残らず、`script-src` は nonce 方式なので本文からスクリプトも起こせない。
    載せるには本文の外に描画経路を用意することになり、記事 1 本のために背負う量ではない。
- **案 C: refresh 前に音声へ焼いて `<audio>` で配る (採用)** — 手元で MIDI を GM 音源に
  通して Opus にし、それをアセットとして置く。MIDI は原本としてダウンロードに添える。
  - Pros: 読者に音源を配らずに済む。聴こえ方が固定される。20 秒の曲なら数 KB。
    再生は `<audio>` だけで済み、スクリプトが要らない。
  - Cons: 当時の音そのものではなくなる。曲を差し替えるたびに変換が要る。

## 決定

案 C を採用する。

### 形式は Opus 単体、コンテナは Ogg

Opus は IETF の [RFC 6716](https://www.rfc-editor.org/rfc/rfc6716) で、既知の特許はすべて
ロイヤリティフリー条件でライセンスされている。低ビットレートでの品質が高い。

単音のオルゴールなのでモノラル、24 kbps の constrained VBR にする。`-b:a` だけを渡すと
libopus は既定の VBR で目標を大きく超え、この素材では 32 kbps 指定に対して実効 56 kbps
まで膨らんだ。`-vbr constrained` を付けると指定どおりに収まる。実測は 1 曲 42 KB から
101 KB (13 秒から 32 秒) で、合計 344 KB である。

コンテナは Ogg (`.opus`) にする。`.webm` にしないのは、拡張子から音声か動画かを決められず、
`contentTypeForPath` が Content-Type を一意に返せなくなるためである。

**第 2 ソース (MP3) は置かない。** Safari の Opus 対応は長く不安定で、`<audio>` で
Ogg Opus が素直に鳴るのは 18.4 以降である。それ以前の Safari では鳴らない。
MP3 を並べれば埋まる (MP3 の特許は 2017 年 4 月にすべて失効しており、いまはパテントフリー)
が、載せる曲は本文が無くても成り立つ添え物で、鳴らない読者が出ることを許容する。
必要になったら `<source>` を 1 行足すだけで済む。

### 音量は焼きながら合わせる

fluidsynth の既定ゲインは 0.2 と控えめで、素直に焼くとピークが -16 dBFS あたりに沈む。
再生バーを押しても聞こえないのでは置く意味がないため、-1 dBFS へ寄せる。

**合わせるには 2 回焼く必要がある。** Opus の復号は、この素材で 3 dB ほどオーバーシュートする。
オルゴールの立ち上がりが鋭いためで、符号化前のピークを -1 dBFS に合わせると復号後は
0 dBFS へ張り付く。1 回目を焼いて復号後のピークを実測し、その差を足し戻して焼き直す。
実測では最終的に -0.9 dB から -1.4 dB に収まった。

音量をいじるのは原本への加工にあたるが、当時の演奏の大小ではなく、いま使っている音源の
既定値が生んだ差である。原本の MIDI はそのまま配るので、そちらに手は入らない。

### MIDI は原本として配る

`.mid` を `audio/midi` で配り、本文からリンクを張る。鳴らないと分かっていて置くのは、
焼いた Opus が当時の音ではないからである。原本を持ち帰る道は残しておく。
ブラウザは MIDI を再生できないので、リンクを開けばダウンロードになる。

### `<audio>` の src はルート相対で書く

相対 URL の解決は `withAssetUrls` が MDAST の上で行う (下記の訂正)。今回、対象を `image` から
`link` へ広げた (MIDI のリンクを `./song.mid` と書けるようにするため)。既存記事に画像以外の
相対リンクは 1 本も無いので、挙動が変わるコンテンツは無い。

**生 HTML の中は書き換えない。** `html` ノードが持つのは文字列で、属性を読むには HTML を
解析し直すことになる。だから本文に直接書く `<audio>` の src だけは、
`/api/v1/notes/<slug>/assets/<file>.opus` とルート相対で書いてもらう。
スラグは一度公開したら変えない規約なので、本文にスラグが埋まることは受け入れる。

### 通す関門は iframe と同じ二段構え

sanitize が許すのはタグと属性の形だけで (`audio` に `controls` / `preload`、
`source` に `src` / `type`)、src の中身は後段の `toAudio` が見る。
`/api/v1/notes/<slug>/assets/` 配下でなければ落とす。外部の音源を貼る予定は無いし、
貼れるようにすると `media-src` を相手ごとに広げ続けることになる。

`toAudio` は属性を引き継がず一から組み直す。本文側が `autoplay` や `loop` を書けてしまうと
絞る意味が無くなるためである。当時のページは `<embed autostart loop>` で強制再生していたが、
それは再現しない。source が 1 つも残らなければ `<audio>` ごと落とす。鳴らない再生バーだけが
残るのは、静かに壊れているのと変わらない。

CSP には `media-src 'self'` を明示する。`default-src` に任せても同じ結果になるが、
`img-src` や `frame-src` と揃えて、外部の音源を許すつもりが無いことを読み取れるようにする。

## 帰結 / Consequences

- 良い面:
  - 読者に soundfont もスクリプトも配らずに曲が鳴る。追加で読み込むのは音声そのものだけ。
  - 聴こえ方がこちらで固定される。読者の環境で音色が変わらない。
  - 音声アセット一般 (`opus` / `mp3` / `mid` / `midi`) が置けるようになった。
  - 画像として貼れないアセットへ、本文から相対パスでリンクを張れるようになった。
- 悪い面・トレードオフ:
  - Safari 18.4 より前では鳴らない。MIDI のダウンロードだけが残る。
  - 焼いた音は当時の音ではない。当時鳴っていたのは Windows の Microsoft GS Wavetable Synth
    で、変換に使う FluidR3 の Music Box とは音が違う。**記事側の脚注で必ず断ること。**
  - 曲を差し替えるたびに手元で変換が要る。変換は CI に載せていない。
  - `<audio>` の src だけ本文にスラグが埋まる。画像やリンクとは書き方が揃わない。
- 検証方法 / 今後の宣言:
  - `app/backend/csp.test.ts` が `media-src 'self'` を固定する。外部ホストを足したら落ちる。
  - `app/backend/services/asset-content-type.test.ts` が音声 4 種の Content-Type を固定する。
  - `app/frontend/components/mdast/mdast-renderer.test.tsx` が「自分のアセットを指す
    `<audio>` だけが残る」「`autoplay` / `loop` は引き継がない」「source が残らなければ
    `<audio>` ごと消える」を固定する。
  - CSP は development では付かないので、音が鳴ることの最終確認は
    `pnpm run preview:staging` で行う。

## 参考 / More Information

- [ADR 0005](0005-mdast-over-html-rendering.md) — 本文は MDAST のまま運ぶ
- [ADR 0007](0007-strict-csp-outside-development.md) — CSP の方針
- [RFC 6716](https://www.rfc-editor.org/rfc/rfc6716) — Opus
- 実装: `app/backend/services/asset-content-type.ts` /
  `app/frontend/components/mdast/audio.ts` /
  `app/frontend/components/mdast/mdast-renderer.tsx` (`keepEmbedHtml`, `toAudio`) /
  `app/backend/services/notes-refresh.service.ts` (`withAssetUrls`) /
  `app/backend/index.ts` (CSP)

## 訂正 (2026-08-17)

本 ADR が指していた関数名 `resolveMdastAssetUrls` は、いまのコードに存在しない。
[#279](https://github.com/yantene/yantene.net/issues/279) で走査を型付き・非破壊に
書き直したときに `withResolvedAssetUrls` へ改名し、
[#295](https://github.com/yantene/yantene.net/issues/295) で素通しの包みを畳んで
`withAssetUrls` になった。**改名した側が ADR の参照を直し忘れていた。**

決定 (音源をアセットとして配り、src はルート相対で書く) は変えていない。実装を指す
名前だけを現在のものに直した。

`.claude/rules/adr.md` の不変性に対する例外という点は
[ADR 0004](0004-github-as-content-source-of-truth.md) /
[0013](0013-math-as-mathml-at-refresh-time.md) / [0007](0007-strict-csp-outside-development.md) と同じ。
本文を直したのは、**ここが「どこを読めばよいか」を示す場所**だからで、存在しない名前を
残すと読む人が探しに行って見つけられない。
