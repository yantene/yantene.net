# 0046. 動きのあるものは AV1 と H.264 の MP4 を並べ、`<video>` で配る

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
  `.mp4` を置いても `application/octet-stream` になる
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
CRF の数字はコーデック間で比較できないため**容量を揃えて画質を見る**。

| 方式                 | 容量     | SSIM   |
| -------------------- | -------- | ------ |
| AV1 (SVT-AV1 CRF 32) | 2,619 KB | 0.9803 |
| VP9 (CRF 37)         | 2,574 KB | 0.9780 |
| H.264 (CRF 28)       | 2,712 KB | 0.9594 |
| H.264 (CRF 23)       | 5,273 KB | 0.9758 |
| H.264 (CRF 20)       | 8,225 KB | 0.9826 |

- **案 A: アニメーション WebP を続ける**
  - Pros: 実装が要らない。
  - Cons: 25 秒を 10 fps で入れて 7.5 MB。止められない。ここから先は fps を削るしかない。
- **案 B: H.264 の MP4 だけを置く**
  - Pros: どのブラウザでも再生できる。ファイルが 1 本で済む。
  - Cons: 上の表のとおり、AV1 の 0.9803 に並ぶには CRF 20 と 23 の間、6 MB から 7 MB を要する。
    **同じ画質なら AV1 の 2.5 倍かかる。** ADR 0022 が Opus を選んだときの
    ロイヤリティフリーという観点とも噛み合わない。
- **案 C: AV1 を第 1 ソース、H.264 を第 2 ソースにする (採用)**
  - Pros: 再生できる環境では 2.6 MB で済み、できない環境も H.264 で必ず再生できる。
  - Cons: 同じ映像を 2 本置くことになる (合計 6.1 MB)。書き出しの手順が 2 回になる。
- **案 D: VP9 (WebM) を第 2 ソースに混ぜる**
  - Pros: AV1 が駄目で VP9 なら再生できる環境 (Safari 14 から 16) を拾える。
  - Cons: **そこは H.264 で埋まる。** 3 本目を置いても届く先が増えず、リポジトリが重くなるだけ。

## 決定

案 C を採用する。

### コンテナは両方 MP4

AV1 を WebM ではなく MP4 へ入れる。ADR 0022 が `.webm` を避けたのと同じ理由で、
拡張子から音声か動画かを決められず `contentTypeForPath` が Content-Type を一意に
返せなくなるためである。AV1 も H.264 も `video/mp4` で配り、どちらのコーデックかは
`<source>` の `type` に書く codecs (`video/mp4; codecs=av01.0.05M.08`) で
ブラウザが選り分ける。

AV1 が読めるのは Chrome 70 以降、Firefox 67 以降、Edge。Safari は 17 以降だが
ハードウェア復号を持つ機種に限られる。だから H.264 を後ろに置く。

### 通す関門は音源と同じ二段構え

sanitize が許すのはタグと属性の形だけで (`video` に `controls` / `preload` / `poster`、
`source` に `src` / `type`)、src の中身は後段の `toVideo` が見る。
`/api/v1/articles/<slug>/assets/` 配下でなければ落とす。source が 1 つも残らなければ
`<video>` ごと落とす。再生できない黒い四角だけが残るのは、静かに壊れているのと変わらない。

音源と共通なのは src の判定だけなので、`audio.ts` を `asset-src.ts` へ改名して
両方から使う。CSP は `media-src 'self'` が既にあるので触らない。

### 属性は固定し、自動再生と繰り返しは**こちらから付ける**

`toAudio` は `autoplay` と `loop` を落とす。音が勝手に鳴るのを避けるためである。
動画では逆に、`autoPlay` と `loop` をこちらから付ける。

**この口はアニメーション画像の置き換えとして作ったからである。** 置き換える相手
(アニメーション WebP や GIF) は読者の同意なく再生され、繰り返し、止める手段が無い。
音の出ない動画を同じように再生させても、読者から見て新しく起きることは何も無い。
**増えるのは止める手段のほうである。** だから `controls` も必ず付ける。

`muted` と `playsInline` を本文側の書き方に委ねないのは、音が出ないことと iOS で
全画面に飛ばないことを、書き忘れで壊したくないためである。

`poster` だけは本文から受け取る。自動再生が止められた環境 (省電力・通信量節約) で、
黒い四角ではなく 1 枚目を出せる。src と同じくアセット API に絞る。

### `<video>` の src はルート相対で書く

ADR 0022 と同じ。生 HTML の中身は MDAST の URL 書き換え (`withAssetUrls`) が届かないので、
`/api/v1/articles/<slug>/assets/<file>.mp4` と直接書く。

## 帰結 / Consequences

- 良い面:
  - 25.9 秒を丸ごと 30 fps で載せて 2.6 MB。アニメーション WebP の 7.5 MB より軽く、
    fps が 3 倍で、画質も上になる。
  - 読者が止められる。シークもできる。
  - 順次読み込みなので、最後まで見ない読者は最後まで落とさない。
  - 動画アセット (`mp4`) を置けるようになった。
- 悪い面・トレードオフ:
  - **`prefers-reduced-motion` を尊重できない。** HTML だけでは再生を止められず、本文から
    スクリプトを起こす経路も無い (`script-src` が nonce 方式のため)。`controls` で
    止められることを唯一の逃げ道とする。置き換える相手のアニメーション画像には
    その逃げ道すら無かった、という点でのみ前進である。
  - 同じ映像を 2 本置くので、コンテンツリポジトリが 1 本ぶん重くなる。
  - 書き出しが手作業になる。CI には載せていない。
  - `<video>` の src だけ本文にスラグが埋まる。画像やリンクとは書き方が揃わない
    (音源と同じ)。
- 検証方法 / 今後の宣言:
  - `app/backend/services/asset-content-type.test.ts` が `mp4` の Content-Type を固定する。
  - `app/frontend/components/mdast/mdast-renderer.test.tsx` が「自分のアセットを指す
    `<video>` だけが残る」「コーデック違いの source を書いた順に保つ」「muted /
    playsinline / loop / autoplay / controls が立つ」「poster は自分のアセットだけ通す」
    「source が残らなければ `<video>` ごと消える」を固定する。
  - `app/backend/csp.test.ts` が `media-src 'self'` を固定する。
  - CSP は development では付かないので、再生の最終確認は `pnpm run preview:staging` で行う。

## 参考 / More Information

- [ADR 0005](0005-mdast-over-html-rendering.md) — 本文は MDAST のまま運ぶ
- [ADR 0007](0007-strict-csp-outside-development.md) — CSP の方針
- [ADR 0022](0022-bake-midi-into-opus-and-serve-audio-assets.md) — 音源を配る二段構え。本 ADR の下敷き
- [RFC 6381](https://www.rfc-editor.org/rfc/rfc6381) — `codecs` パラメータの書式
- 実装: `app/backend/services/asset-content-type.ts` /
  `app/frontend/components/mdast/asset-src.ts` /
  `app/frontend/components/mdast/mdast-renderer.tsx` (`keepEmbedHtml`, `assetSourcesOf`, `toVideo`)
