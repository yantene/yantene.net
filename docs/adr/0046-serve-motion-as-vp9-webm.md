# 0046. 動きのあるものは VP9 の WebM 1 本で配り、自動再生しない

- Status: Accepted
- Date: 2026-09-27
- Deciders: @yantene

## Context / 背景

「トランジスタでコンピュータを組む (Flip-Flop 編)」で、ブレッドボードに組んだ
D Flip-Flop が動いている 26 秒の映像を載せたい。ボタンを押すと LED が移り、離しても
残る、という記事の主張そのものを見せる箇所で、記事の落としどころにあたる。

いま記事に動きを載せる手段はアニメーション画像しかない。詰まっているのは 2 か所で、
[ADR 0022](0022-bake-midi-into-opus-and-serve-audio-assets.md) が音源で踏んだのと同じ場所である。

- `app/backend/services/asset-content-type.ts` が返す Content-Type に動画が無く、
  置いても `application/octet-stream` になる
- `app/frontend/components/mdast/mdast-renderer.tsx` の `keepEmbedHtml` が通す生 HTML は
  `<iframe>` と `<audio>` だけで、`<video>` を書いても跡形もなく消える

そこでいったんアニメーション WebP にしたが、無理があった。同じ素材 (1920x1080、25.9 秒、
無音) で測った結果が次である。

| 設定                  | 長さ | fps | 容量   |
| --------------------- | ---- | --- | ------ |
| 5 fps / 760 px / q25  | 19 s | 5   | 1.5 MB |
| 10 fps / 860 px / q62 | 25 s | 10  | 7.5 MB |

**容量を削る方向は全部外れた。** 手ブレ補正 (vidstab) をかけると 12.5 MB、余白の切り抜きは
9.3 MB と、どちらも増える。暗い余白は元々ほとんど容量を食っておらず、削ると残りが全部
ディテールになるためである。q を 62 から 55 へ落としても 7.7 MB で減らない。容量を決めて
いるのはフレーム数と動きの量であって、圧縮率ではない。

そのうえアニメーション画像には**読者が止める手段が無い。**

## 検討した選択肢

720p・25.9 秒・無音で揃えて測った。SSIM は 720p へ落とした原版との比較で、
CRF の数字はコーデック間で比較できないため**容量と画質の両方を並べる**。

| 方式         | 容量     | SSIM   | ライセンス         |
| ------------ | -------- | ------ | ------------------ |
| AV1 CRF 32   | 2,620 KB | 0.9803 | ロイヤリティフリー |
| VP9 CRF 31   | 4,342 KB | 0.9845 | ロイヤリティフリー |
| VP9 CRF 34   | 3,333 KB | 0.9814 | ロイヤリティフリー |
| VP9 CRF 37   | 2,551 KB | 0.9782 | ロイヤリティフリー |
| H.264 CRF 23 | 5,273 KB | 0.9758 | 特許プールあり     |
| H.264 CRF 20 | 8,225 KB | 0.9826 | 特許プールあり     |

- **案 A: アニメーション WebP を続ける**
  - Pros: 実装が要らない。
  - Cons: 25 秒を 10 fps で入れて 7.5 MB。止められない。ここから先は fps を削るしかない。
- **案 B: H.264 の MP4 を置く**
  - Pros: どのブラウザでも再生できる。
  - Cons: 同じ画質を出すのに VP9 の 2 倍近くかかる。そして特許プールのあるコーデックで、
    ADR 0022 が Opus を選んだときの観点と噛み合わない。
- **案 C: AV1 (WebM) を先頭に、VP9 (WebM) を後ろに置く**
  - Pros: AV1 を再生できる環境では 700 KB 軽くなる。
  - Cons: **同じ映像を毎回 2 回焼くことになる。** 得るのは 700 KB で、
    払うのは記事を書くたびの手間である。
- **案 D: VP9 (WebM) 1 本 (採用)**
  - Pros: 焼くのが 1 回。ロイヤリティフリー。**届く先は案 C と同じ。**
  - Cons: AV1 対応の環境も VP9 を受け取るので、案 C より 700 KB 重い。

## 決定

案 D を採用する。VP9 を WebM に入れて `<source>` 1 つで配る。CRF は 34 を基準にする
(3,333 KB / SSIM 0.9814)。

### なぜ AV1 ではなく VP9 を 1 本に選ぶか

**AV1 が届く先は、全部 VP9 も再生できる。逆は成り立たない。**

| コーデック | 届く先                                                                            |
| ---------- | --------------------------------------------------------------------------------- |
| AV1        | Chrome 70 以降 / Firefox 67 以降 / Edge。**Safari は WebM の AV1 を再生できない** |
| VP9        | 上の全部に加えて、Safari (macOS 14.1 以降 / iOS 15 以降)                          |

Safari は AV1 を MP4 でしか再生できず、しかも MP4 に入れてもハードウェア復号器を積んだ
機種 (M3 以降の Mac、M4 iPad Pro、iPhone 15 Pro 以降) に限られる。**AV1 を 1 本だけ置くと
Safari が全滅する。** iOS のブラウザはすべて WebKit なので、iPhone と iPad も含めて落ちる。

VP9 なら macOS 14.1 (2021 年 4 月) と iOS 15 (2021 年 9 月) 以降で再生でき、A14 以降の
機種はハードウェアで復号する。**1 本しか置かないなら、VP9 が唯一の選択肢になる。**

払う代償は容量だけで、しかも小さい。AV1 CRF 32 が 2,620 KB / SSIM 0.9803 なのに対し、
VP9 CRF 34 は 3,333 KB / SSIM 0.9814。**画質はむしろ上で、713 KB 多いだけである。**
置き換えるアニメーション WebP が 7.5 MB だったことを思えば、誤差に近い。

**AV1 が要るほど重い映像を載せたくなったら、`<source>` を 1 行先頭に足すだけで済む。**
`toVideo` は source を書いた順にそのまま保つので、実装は何も変わらない
(ADR 0022 が MP3 の第 2 ソースについて言ったのと同じ)。

### H.264 を置かない

**特許プールのあるコーデックを、保険のためだけに置き続けない。**
ADR 0022 が MP3 の第 2 ソースを置かなかったのと同じ判断である。

保険が効く相手もほとんどいない。VP9 で 2021 年以降の Safari は埋まるので、
取りこぼすのはそれより古い Safari だけになる。そこには `poster` の 1 枚が残る。

### コンテナは WebM

ADR 0022 が `.webm` を避けたのは、拡張子から音声か動画かを決められず
`contentTypeForPath` が Content-Type を一意に返せなくなるためだった。
**ここでは「`.webm` は動画」と決めることで、その曖昧さを解く。** 音声は Ogg (`.opus`)
に置くと同じ ADR が決めているので、WebM に音声だけを入れることはない。

`.mp4` は表に載せない。`application/octet-stream` のままにする。

### 通す関門は音源と同じ二段構え

sanitize が許すのはタグと属性の形だけで (`video` に `controls` / `preload` / `poster`、
`source` に `src` / `type`)、src の中身は後段の `toVideo` が見る。
`/api/v1/articles/<slug>/assets/` 配下でなければ落とす。source が 1 つも残らなければ
`<video>` ごと落とす。再生できない黒い四角だけが残るのは、静かに壊れているのと変わらない。

`type` には codecs まで書く (`video/webm; codecs=vp9`)。1 本しか置かないうちは効かないが、
後から `<source>` を足したときに、再生できない先頭を取りに行ってから落とす動きを防ぐ。

音源と共通なのは src の判定だけなので、`audio.ts` を `asset-src.ts` へ改名して
両方から使う。CSP は `media-src 'self'` が既にあるので触らない。

### 属性は固定し、**自動再生しない**

`toVideo` は属性を引き継がず、次の 4 つだけを付ける。

```
controls playsInline preload="metadata" poster
```

**アニメーション画像の置き換えとして作った口だが、置き換える相手と同じ振る舞いには
しない。** アニメーション WebP や GIF は読者の同意なく再生され、繰り返し、止める手段が
無い。同じように `autoPlay` と `loop` を付ければ置き換えとしては自然に見えるが、
**それでは `prefers-reduced-motion` を尊重できない。** HTML だけでは再生を止められず、
本文からスクリプトを起こす経路も無い (`script-src` が nonce 方式のため) ので、
逃げ道は「動いてしまってから `controls` で止める」しか残らない。

読者が押すまで動かないなら、その問題は起きない。`preload="metadata"` なので、
押すまで本体も落ちてこない。スクロールで通りかかっただけの読者に 3.3 MB を
払わせずに済む。

`controls` は必ず付ける。自動再生しない以上、これが無いと再生する手段が無い。
`playsInline` も本文側の書き方に委ねない。iOS で全画面に飛ばないことを、書き忘れで
壊したくないためである。

**`muted` は付けない。** 自動再生しないなら要らず、音のある動画を将来置いたときに
黙らせてしまう。`<audio>` と違って、鳴るのは読者が押したあとである。

`poster` は本文から受け取る。読者が押すまでの 1 枚であり、VP9 を再生できない古い
Safari に残る 1 枚でもある。src と同じくアセット API に絞る。
**動かない状態が既定になった以上、poster は実質必須である。**

`aria-label` も本文から受け取る。**画像の alt にあたるもので、動画には他に名前が無い。**
`<video>` の中に書いたフォールバックの文字列は、`toVideo` が children を `<source>` だけに
組み直すので残らず、`poster` にも alt は付けられない。空文字のときは付けない。
`hast-util-sanitize` の既定は `ariaLabel` を `a` / `img` / `ul` などにしか許していないので、
schema に明示して通す。

無いときに `<video>` ごと落とすことはしない。src が通らないときと違って、名前が無くても
映像そのものは読者に届く。**書き忘れを止めるのはコンテンツ側の規範の仕事**で、
`content/AGENTS.md` が画像の alt と同じ扱いで必須にしている。

### `<video>` の src はルート相対で書く

ADR 0022 と同じ。生 HTML の中身は MDAST の URL 書き換え (`withAssetUrls`) が届かないので、
`/api/v1/articles/<slug>/assets/<file>.webm` と直接書く。

## 帰結 / Consequences

- 良い面:
  - 25.9 秒を丸ごと 30 fps で載せて 3.3 MB。アニメーション WebP の 7.5 MB より軽く、
    fps が 3 倍で、画質も上になる。
  - **書き出しが 1 回で済む。** 記事を書くたびに払う手間が増えない。
  - 配るものが全部ロイヤリティフリーになった。音が Opus、動きが VP9。
  - 読者が始める。止められるし、シークもできる。
  - `preload="metadata"` なので、押さなかった読者は本体を落とさない。
    順次読み込みなので、最後まで見ない読者は最後まで落とさない。
- 悪い面・トレードオフ:
  - AV1 を再生できる環境も VP9 を受け取るので、そこだけを見れば 713 KB 損している。
    **焼く回数を 1 回に保つために払っている。**
  - **Safari macOS 14.1 未満と iOS 15 未満では再生できない。** どちらも 2021 年の版。
    取りこぼした読者には `poster` の 1 枚が残る。ADR 0022 が「Safari 18.4 より前では
    鳴らない」を許容したのと同じ線の引き方だが、**あちらは添え物の曲で、こちらは記事の
    落としどころである。** 静止画が残ることをもって許容する。
  - 読者が押さなければ動かない。アニメーション画像は通りかかるだけで動いていたので、
    **気づかれずに終わる可能性がある。** poster に山場の 1 枚を選ぶことで補う。
  - `<video>` の src だけ本文にスラグが埋まる。画像やリンクとは書き方が揃わない
    (音源と同じ)。
- 検証方法 / 今後の宣言:
  - `app/backend/services/asset-content-type.test.ts` が `webm` を `video/webm` に、
    `mp4` を `application/octet-stream` に固定する。**H.264 を置きたくなったら、
    この行が先に落ちる。**
  - `app/frontend/components/mdast/mdast-renderer.test.tsx` が「自分のアセットを指す
    `<video>` だけが残る」「コーデック違いの source を書いた順に保つ」「controls と
    playsinline が立ち、autoplay と loop は立たない」「poster は自分のアセットだけ通す」
    「aria-label は空でなければ残す」
    「source が残らなければ `<video>` ごと消える」を固定する。**source を複数並べる検査は
    残してある。** いまは 1 本だけ置くが、AV1 を足すときにこの並びが効く。
  - `app/backend/csp.test.ts` が `media-src 'self'` を固定する。
  - CSP は development では付かないので、再生の最終確認は `pnpm run preview:staging` で行う。

## 参考 / More Information

- [ADR 0005](0005-mdast-over-html-rendering.md) — 本文は MDAST のまま運ぶ
- [ADR 0007](0007-strict-csp-outside-development.md) — CSP の方針
- [ADR 0022](0022-bake-midi-into-opus-and-serve-audio-assets.md) — 音源を配る二段構え。本 ADR の下敷き
- [RFC 6381](https://www.rfc-editor.org/rfc/rfc6381) — `codecs` パラメータの書式
- [Add AV1 caveat to WebM data](https://github.com/Fyrd/caniuse/issues/7253) — Safari が WebM の AV1 を再生できないこと
- [WebM: Browser Support, Codecs, Known Issues](https://www.testmuai.com/learning-hub/webm-browser-support/) — Safari の WebM 対応時期
- 実装: `app/backend/services/asset-content-type.ts` /
  `app/frontend/components/mdast/asset-src.ts` /
  `app/frontend/components/mdast/mdast-renderer.tsx` (`keepEmbedHtml`, `assetSourcesOf`, `toVideo`)
