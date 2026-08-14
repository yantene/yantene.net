# 0021. 閲覧の計測は Cloudflare Web Analytics のビーコンで行い、script-src を 1 つ開く

- Status: Accepted
- Date: 2026-08-14
- Deciders: @yantene

## Context / 背景

書いたものが読まれたのか、どこから来た人が読んだのかを知る手段が無かった。

エッジの HTTP リクエストログ (`httpRequestsAdaptiveGroups`) は全リクエストを漏れなく
持っているが、これで「読まれた」を測ろうとすると 2 つの点で足りない。

**中身の半分ほどが人ではない。** `/notes/` 以下への 7 日間 942 件のうち、Cloudflare が
検証済みとするボットだけで 405 件 (43%) を占めていた。残る 537 件も Curl が 161 件あり、
ブラウザらしき名乗りは 200 件ほどしかない。国別でも United States が Japan を上回っていて、
人の分布とは考えにくい。Bot Management のスコアは Free プランでは使えないので、未検証の
クローラーを機械的に落とす手も無い。**記事別のリクエスト数を並べても、人気の順にはならない。**

**リファラーが露出していない。** この dataset でチャートに指定できるのは Path / Host /
Country / Source device type / Source browser / Edge status code / Verified Bot Category
などで、参照元のディメンションが無い。どこから来たのかが一切分からない。

なお、ノートには既に閲覧数と人気スコアがある ([0011](0011-reader-session-in-kv.md))。
あれは「よく読まれている記事」を並べるためにサイトが自分で使う数で、書き手が流入元を
調べるためのものではない。ここで欲しいのは後者である。

## 検討した選択肢

- **案 A: Cloudflare Web Analytics のビーコンを入れる** — ブラウザで JS を動かし、
  RUM Pageload Events として記録させる。
  - Pros: Referer Host / Referer Path / Request Path / Device Type / Browser など、欲しい
    ディメンションがそのまま揃う。JS を実行しないクローラーは最初から入らないので、
    ボットの切り分けを自前で持たなくてよい。cookie も指紋も使わない。
  - Cons: 外部スクリプトを 1 つ読むことになり、[0007](0007-strict-csp-outside-development.md)
    で厳格に保っている `script-src` に穴が開く。JS を切っている読み手・広告ブロッカーを
    入れている読み手は数に入らない。読み手のリクエストが第三者へ飛ぶ。
- **案 B: Worker 側で自前に記録する** — document のリクエストは必ず Worker を通るので、
  `Referer` ヘッダ・パス・国・UA を Workers Analytics Engine に書く。
  - Pros: 外部スクリプトを足さないので CSP は無傷。Webmention を自前で受ける方針
    ([0016](0016-receive-webmentions-in-house.md)) とも揃う。JS の有無に関わらず取れる。
  - Cons: **背景で挙げた問題がそのまま残る。** クローラーも記録に残るので、「人かどうか」を
    こちら側で当て続けることになる。その判定は名乗りを正規表現で見るしかなく
    (`handlers/notes/view-recording.ts` の `isLikelyBot`)、名乗りを詐称する相手には
    効かない。半分近くがボットという現状を正すには弱い。
- **案 C: 何もしない** — 記事ごとの相対的な多寡だけ見て、流入元は諦める。
  - Pros: 追加のコードも外部への依存も無い。
  - Cons: 背景の課題が何も解決しない。

## 決定

**案 A を採る。** `<head>` に Cloudflare Web Analytics のビーコンを置く。

案 B を採らなかったのは、**自前で記録しても「人が読んだか」を見分ける仕事が残るため**。
背景で見たとおり困っているのはリクエストが取れないことではなく、取れたリクエストの半分が
人でないことである。JS を動かす相手だけが記録されるビーコンは、その切り分けを実行環境に
肩代わりさせる。ここで払う代償が外部スクリプト 1 つで、それは CSP に名指しで書けば
読み取れる形に留められる。

以下、決めたことを個別に記す。

### 自動挿入ではなく手で置く

Cloudflare はプロキシ側で `<script>` を挿し込めるが、挿し込まれたタグには nonce が付かず、
`script-src` が nonce 方式のこのサイトでは CSP が止めてしまう。よって挿入は無効にし、
`app/frontend/root.tsx` が自分で `<script>` を出す。

ダッシュボード側のサイトは **「Enable with JS Snippet installation」に置いてある。**
「Enable」に戻すと Cloudflare の挿し込みとこちらのタグで 2 本になる。**どちらも同じ URL
なので CSP は止めず、数が二重になるだけで表からは分からない。** リポジトリの中には現れない
設定なので、ここに書いておく。

### CSP に開けるのは 2 つだけ

| ディレクティブ | 足すもの                                              | 理由               |
| -------------- | ----------------------------------------------------- | ------------------ |
| `script-src`   | `https://static.cloudflareinsights.com/beacon.min.js` | ビーコン本体を読む |
| `connect-src`  | `https://cloudflareinsights.com`                      | ビーコンの送り先   |

`script-src` はホストではなく**パスまで**書く。ホストだけを許すと、同じホストに置かれた
別のファイルまで通ってしまう。送り先が自ドメインの `/cdn-cgi/rum` ではないのは、
自動挿入ではなく手で置いた場合の挙動がそうだからである。

**ビーコンのタグに nonce は付けない。** 付けると「nonce を持つから通った」ことになり、
CSP に並べた URL が効いているのか確かめられなくなる。外から読むものはホストを名指しして
通す ([0017](0017-webfonts-from-google-fonts.md) の Google Fonts と同じ扱い)。

読み込む先と送り先は `app/lib/constants/web-analytics.ts` に置き、CSP を組む側と
`<script>` を出す側の両方がそこから引く。片方だけ書き換わると、ブラウザが黙ってビーコンを
止める。

### development では出さず、staging では出す

手元で開き直したぶんが混ざると、流入元を見る目的そのものが濁るので development では
出さない。一方 **staging では出す**。CSP が付くのは development 以外だけなので
([0007](0007-strict-csp-outside-development.md))、外部スクリプトを足したこの変更を
本番同等の条件で試せる場所が staging しか無い。ここを外すと、CSP がビーコンを止めていても
production に出すまで分からない。

staging (と `preview:staging` の localhost) のぶんは同じサイトに混ざるが、ホスト名で
切り分けられる。staging は BASIC 認証の内側にあり、そもそも件数が問題になる規模ではない。

### サイトトークンはリポジトリに置く

トークンは配る HTML にそのまま載る値で、秘密ではない。secret や `wrangler.jsonc` の
`vars` に逃がさず定数として置くのは、**環境ごとの設定漏れという失敗の形を無くすため**。
入れ忘れても「ビーコンの無い正常なページ」に見えるだけで、数が入らないこと以外に手がかりが
無い。リポジトリの中にあれば、値の有無は差分に出る。

### SPA の遷移も数える

ビーコンは既定で History API の `pushState` を差し替え、`onpopstate` を見る。React Router の
ページ遷移は再読み込みを起こさない ([0006](0006-react-router-framework-mode.md)) ので、
これが無いと入口の 1 枚しか数えられない。`spa` オプションは指定しない (既定のまま)。

## 帰結 / Consequences

- 良い面
  - 参照元・パス・端末・ブラウザが揃った形で読まれ方を見られるようになった。
  - JS を実行しない相手が最初から入らないので、ボットを弾く仕掛けを自前で抱えずに済む。
    `isLikelyBot` の正規表現を育て続ける必要が無い。
  - cookie を置かず、指紋も取らない。同意を求める種類の計測にはならない。
- 悪い面・トレードオフ
  - **`script-src` に外部の穴が 1 つ開いた。** [0007](0007-strict-csp-outside-development.md)
    で守ってきた「自分の出したものしか実行しない」は崩れ、`static.cloudflareinsights.com`
    に置かれた `beacon.min.js` の中身を信じることになった。中身は Cloudflare が随時
    差し替える。
  - **読み手のリクエストが第三者へ飛ぶようになった。** これまで読み手のブラウザが触るのは
    自ドメインと Google Fonts だけだった ([0017](0017-webfonts-from-google-fonts.md))。
    行き先が 1 つ増えている。
  - **JS を切っている読み手・ブロッカーを入れている読み手は数に入らない。** つまりこの数は
    「読まれた回数」ではなく「JS を動かすブラウザで読まれた回数」である。ハッシュ由来の
    ルーターも対象外だが、このサイトは使っていない。
  - **ノートの閲覧数 ([0011](0011-reader-session-in-kv.md)) とは別の数になる。** あちらは
    サーバー側で数えて同じ日の読み直しを外したもの、こちらはブラウザから届いたもので、
    母数も除外の仕方も違う。**突き合わせても一致しない。** 人気順の出どころは引き続き
    D1 の側であり、こちらを順位に使うことはしない。
  - サイトトークンがリポジトリに入った。秘密ではないので漏洩ではないが、他人がこの値で
    偽のビーコンを送り込むことはできる。
- 検証方法 / 今後の宣言
  - `app/backend/csp.test.ts` が、開いたのがこの 2 つだけであることをディレクティブ単位で
    固定する。増えても減っても落ちる。
  - `app/backend/handlers/web-analytics.test.ts` が、載る環境・読み込む URL・トークンの形を
    固定する。プレースホルダのまま出せない。
  - 単体テストが見られるのは「載せる」と決めるところまでで、実際にタグが出たかは届かない。
    そこは `pnpm run smoke` が実環境の HTML を見て確かめる。
  - CSP に関わる変更なので、`pnpm run preview:staging` で `beacon.min.js` が実際に読まれ、
    コンソールに CSP 違反が出ないことを確認してから出す。

## 参考 / More Information

- [0007](0007-strict-csp-outside-development.md) — `script-src` を厳格に保つ判断。ここに穴を開けた
- [0011](0011-reader-session-in-kv.md) — サーバー側で数える閲覧数。こちらとは別物
- [0017](0017-webfonts-from-google-fonts.md) — 外部ホストを名指しで通す先例
- [Cloudflare Web Analytics — Get started](https://developers.cloudflare.com/web-analytics/get-started/)
- [Cloudflare Web Analytics — SPAs](https://developers.cloudflare.com/web-analytics/get-started/web-analytics-spa/)
- [yantene/yantene.net#219](https://github.com/yantene/yantene.net/issues/219) — 背景の実測値
