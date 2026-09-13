# 0037. 表示する言語は cookie に預け、切り替えはサーバーの受け口で行う

- Status: Accepted
- Date: 2026-09-12
- Deciders: @yantene

## Context / 背景

UI の文言は日英の 2 つを持っていて、どちらで描くかは 1 リクエストにつき 1 回
`resolveLocale` が決めている — `locale` cookie を最優先で見て、無ければ
`Accept-Language`、それも読めなければ既定 (`en`) に倒す。

**決まった結果を読み手が変える手立てが無かった。** 英語のブラウザから開いた日本語話者は
英語の UI しか見られず、逆も同じ。cookie を見る側は既に書いてあるのに、書く側が無い。

置き場所はヘッダーに決まっている (全ページに出ていて、言語は「いまのページ」ではなく
「サイト全体」の設定なので)。決めるのは**どうやって cookie を書くか**である。

前提が 2 つある。

- **記事の本文は日本語のまま。** 切り替わるのは UI の文言だけで、同じ URL が指す
  読み物そのものは変わらない (`og:locale` を `ja_JP` で固定してあるのはこのため)
- **ページの HTML は共有キャッシュに載せていない。** Workers の応答は
  `Cache-Control` を付けない限りエッジに保存されないので、ロケールで表現が分かれる
  ことによる取り違えは起きていない。**HTML に `Cache-Control` を足すときは、ここが
  前提でなくなることに注意する** (`Vary: Cookie` は Cloudflare のエッジでは
  キャッシュキーに入らない。[content-cache-control.ts](../../app/backend/handlers/articles/content-cache-control.ts)
  に同じ罠の記録がある)

## 検討した選択肢

- **案 A: クライアントで `i18next.changeLanguage()` を呼び、`document.cookie` に書く** —
  往復なしで字が入れ替わる。
  - Pros: 速い。ページを読み直さないので、読んでいた位置も検索結果も残る
  - Cons: **描き直されるのは React が描いた部分だけ。** `<title>` と `description` と
    OGP は loader が決めたロケールから `buildPageMeta` が組んでいて、meta 関数は
    React の外で動く。言語を替えても前の言語の meta が残り、その状態で共有されると
    「日本語のページなのに英語の題」が出ていく
  - Cons: JavaScript が動かない環境では切り替えられない
- **案 B: URL にロケールを持たせる (`/ja/articles`、`?lang=ja`)** — 表示が URL から決まる。
  - Pros: 共有できる。キャッシュとも素直に噛み合う
  - Cons: **同じ読み物に URL が 2 本できる。** canonical・OGP・sitemap・フィード・
    Webmention の宛先が、どれも「どちらを正とするか」を決め直す羽目になる。
    変わるのが UI の文言だけであることに対して、払う代償が大きすぎる
  - Cons: 記事の URL は既に外に出ている。増やすと過去の URL の面倒が増える
- **案 C: cookie を置くサーバーの受け口へ POST し、元のページへ 303 で戻す** —
  素のフォームで送り、ページを読み直す。
  - Pros: **ページ全体が 1 つのロケールで組み直される。** `<html lang>` も meta も
    本文も、必ず同じ言語で揃う
  - Pros: JavaScript を前提にしない。読み手の環境に関係なく切り替わる
  - Pros: URL が増えない
  - Cons: 切り替えのたびにページを読み直す

## 決定

**案 C を採る。** `POST /locale` を Hono に置き、`locale` cookie を 1 年で預けて、
送られてきた戻り先へ 303 で返す。ヘッダーの切り替えは React Router の `<Form>` ではなく
素の `<form method="post">` にして、JavaScript の有無に関わらず同じ経路を通す。

決め手は**ページの中で言語が食い違わないこと**である。案 A の速さは魅力だが、
速さと引き換えに meta だけが前の言語で残る。それは画面の上では見えず、共有したときに
初めて外へ出る類の壊れ方で、気づく手掛かりが無い。言語の切り替えは滅多に起きない操作
(たいていはサイトに来て 1 回) なので、そこに 1 往復を払うのは割に合う。

受け口を GET にしないのは、リンクの先読みや事前取得で勝手に言語が変わらないようにする
ため。読めないロケールを送られたら既定に倒さず 400 を返す (fail-loud)。倒すと、綴りを
間違えたフォームが「押しても英語のまま」という形でだけ壊れ、原因に辿り着けない。

戻り先は読み手が好きに書ける値なので、**同一オリジンのパスだけを通す**。`//example.com`
と `/\example.com` は先頭が `/` でもスキーム相対 URL として別のオリジンへ飛ぶので、
名指しで落とす。落としたときは切り替え自体は通してトップへ戻す。

cookie に `HttpOnly` は付けない。中身は読み手が自分で選んだ表示の好みで、盗まれて困る
ものが入っていない。読める状態にしておけば、後からクライアント側だけで切り替える手を
足す余地も残る。

## 帰結 / Consequences

- 良い面: ページの中で言語が食い違わない。`<html lang>`・meta・本文が必ず揃う
- 良い面: JavaScript が動かない環境でも切り替えられる
- 良い面: URL が 1 本のまま。canonical・OGP・sitemap・フィードはどれも触らずに済む
- 悪い面: 切り替えるとページを読み直す。読んでいた位置は失われる (戻り先にクエリは
  残すので、検索結果を見たまま言語だけ変えることはできる)
- 悪い面: cookie を持てない読み手は `Accept-Language` のまま。押しても変わらないが、
  その環境では他に手立てが無い
- 検証方法: `app/backend/handlers/locale.handler.test.ts` が、戻り先の絞り込みと
  cookie の形、読めないロケールを 400 にすること、GET では切り替わらないことを固定する。
  ヘッダー側は `app/frontend/components/layout/header.test.tsx` が、切り替えが
  `POST /locale` へ送る素のフォームであることを見張る

## 参考 / More Information

- `app/lib/i18n/resolve-locale.ts` — cookie を読む側。`Cookie: locale=%` で全ページが
  500 になった件 ([#309](https://github.com/yantene/yantene.net/issues/309)) の記録もここ
- [ADR 0007](0007-strict-csp-outside-development.md) — 切り替えに inline script を
  使わない理由 (script-src は nonce 方式のまま厳格)
