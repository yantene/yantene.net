# 0020. `/notes/<slug>` は Accept を見て原文 Markdown を返す

- Status: Accepted
- Date: 2026-08-14
- Deciders: @yantene

## Context / 背景

原文 Markdown は `/notes/<slug>.md` で取れる ([0009](0009-serve-note-source-markdown-verbatim.md))。
URL を自分で組み立てられる場面はこれで足りるが、記事 URL をそのまま機械に渡す場面 —
人からもらったリンクをエージェントに食わせる、HEAD で表現を探る — では「`.md` を足せば原文が
出る」という知識が要る。拡張子なしの記事 URL でも、`Accept` で名指しすれば原文を取れるように
したい ([#216](https://github.com/yantene/yantene.net/issues/216))。

配信経路 (R2 の `notes/<slug>/source.md`) は 0009 で出来上がっているので、足すのは Accept の
解釈とルーティングの分岐だけ。ただし同じ URL が 2 つの表現を持つことになるため、次の 2 つが
危ない。

1. **ブラウザの Accept には必ずワイルドカードが入っている。** Chrome も Firefox も
   `*/*;q=0.8` を末尾に置く。これを Markdown 側に数えると、全訪問者に記事ページではなく
   原文が配られる。
2. **Cloudflare のエッジは `Accept-Encoding` 以外の `Vary` をキャッシュキーに含めない。**
   `Vary: Accept` を正しく出しても、共有キャッシュが表現を取り違え得る。

## 検討した選択肢

- **案 A: `text/markdown` が Accept に含まれるかだけを見る** — 部分一致で判定する。
  - Pros: 実装が数行で済む。
  - Cons: `*/*` を含めてしまうか、含めない実装にしても q 値を読まないので
    `text/html, text/markdown;q=0.1` のような「HTML のほうがいい」を汲めない。
    判定の安全性が Accept の書き方の運次第になる。
- **案 B: `.md` へ 307 リダイレクトする** — ネゴシエーションはせず、Location だけ返す。
  - Pros: 表現が URL ごとに 1 つに保たれ、キャッシュの取り違えが起きない。
  - Cons: 往復が 1 つ増える。リダイレクトを追わないクライアントには届かない。
    そもそも「記事 URL をそのまま渡す」用途で、返る URL が別物になるのは扱いにくい。
- **案 C: q 値つきのプロアクティブ content negotiation** — Accept を解釈して表現を選ぶ。
  - Pros: 記事 URL がそのまま両方の入口になる。HTTP の既定の仕組みに乗る。
  - Cons: 同じ URL が 2 表現を持つので、判定とキャッシュの両方を慎重に設計する必要がある。

## 決定

案 C を採用する。判定はこう定める。

```
qMD   = text/markdown に完全一致する媒体範囲の q  (無ければ 0)
qHTML = text/html にマッチする最も具体的な媒体範囲の q (text/html > text/* > */*)

Markdown を返す ⟺ qMD > 0 かつ qMD > qHTML
```

- **ワイルドカードを非対称に扱う。** `*/*` や `text/*` は「サーバーが選べ」の意思表示なので
  既定 (HTML) に倒し、**Markdown は名指しでしか取れない**。これで背景 1 を構造的に潰す。
  同点 (`text/markdown, text/html`) も同じ理由で HTML。
- **受け付けるのは `text/markdown` だけ。** `text/x-markdown` は登録されていない事実上の別名、
  `text/plain` は原文以外にも使われる。名指しの意図が疑いなく読めるものに限る。
- **406 は返さない。** 外れた要求はすべて記事ページ (HTML) を返す。ブラウザで開いて何も
  出ないより、既定の表現を返すほうが害が小さい。
- **Markdown 応答は `private, max-age=3600` で固定する。** `Vary: Accept` も出すが、背景 2 の
  とおりエッジはそれを見ない。共有キャッシュへの保存そのものを止めるのが本命の防御で、
  BASIC 認証の有無で振り分ける `.md` 側 (0009) とは別の理由から環境に依らず `private`。
  あわせて `Content-Location: /notes/<slug>.md` を付け、いま返した表現の固有 URL を示す
  (RFC 9110 §8.7)。HTML 応答には `Vary: Accept` と
  `Link: </notes/<slug>.md>; rel="alternate"; type="text/markdown"` を足し、Markdown 版の
  存在を機械が発見できるようにする。
- **拡張子はネゴシエーションに優先する。** `/notes/<slug>.md` は Accept を見ない。この URL の
  表現は 1 つなので `Vary` も付けず、キャッシュの扱いは 0009 のまま変えない。
- **ルータは `/:file` 1 本に保つ。** `/:file{[^/]+[.]md}` と `/:slug` に分けると、Hono の
  SmartRouter が RegExpRouter を諦めて TrieRouter に落ち、この 1 ルートのためにアプリ全体の
  リクエストが遅いマッチャーを通る。3 つの分岐 (`.md` / Markdown 要求 / 素通し) は
  ハンドラの中で分ける。
- 404 (存在しない slug・slug として不正) と 500 (D1 に在るのに R2 に原文が無い) の扱いは
  `.md` と同じ。前者は RFC 9457 Problem Details、後者は fail-loud。
- **閲覧数は数えない。** 原文の配信はページ描画を経ないので、読み手のセッション
  ([0011](0011-reader-session-in-kv.md)) も発行しない。

## 帰結 / Consequences

- 良い面: 記事 URL をそのまま機械に渡せる。配信経路は 0009 のものをそのまま使うので、
  原文がバイト単位で保たれる性質も 404 / 500 の扱いも自動的に揃う。
- 悪い面・トレードオフ: 同じ URL が 2 表現を持つぶん、Markdown 応答を共有キャッシュに
  載せられない (`private`)。判定を緩める変更は読者の目に見える壊れ方をするので、
  Accept の扱いを触るときは真理値表のテストを先に読むこと。
- 検証方法 / 今後の宣言: `markdown-negotiation.test.ts` が判定の真理値表を、
  `markdown.handler.test.ts` が 3 分岐のヘッダーと、Chrome / Firefox の実 Accept が
  ページに落ちること、単一ルートが保たれていること (`SmartRouter + RegExpRouter`) を固定する。
  デプロイ後は `scripts/smoke.mjs` が両分岐の Content-Type を確かめる。エッジの `Vary` 無視に
  対しては自動テストが効かないので、staging と production で**同じ URL をブラウザと
  `Accept: text/markdown` で交互に叩き**、毎回それぞれ正しい表現が返ることを見る。

## 参考 / More Information

- [Issue #216](https://github.com/yantene/yantene.net/issues/216)
- [0009](0009-serve-note-source-markdown-verbatim.md) — 原文の配信経路 (この ADR はその拡張)
- [0006](0006-react-router-framework-mode.md) — Hono と React Router の分担
- [0010](0010-hand-written-service-worker-without-precache.md) — Service Worker は
  Markdown を名指しした要求に関わらない
- [RFC 9110 §12.5.1 (Accept)](https://www.rfc-editor.org/rfc/rfc9110#name-accept) /
  [§8.7 (Content-Location)](https://www.rfc-editor.org/rfc/rfc9110#name-content-location)
