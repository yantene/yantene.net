# 0052. 共有先の印は、黒を許す社は黒、許さない社は正式な色で出す

- Status: Accepted
- Date: 2026-11-27
- Deciders: @yantene

## Context / 背景

記事の共有先は X / Facebook / Bluesky / Mastodon / Threads / はてなブックマークの 6 つ
(#597)。素材は出ていく先と同じ Simple Icons (react-icons/si) で、色は `brand-marks.css`
が持つ ([ADR 0043](0043-show-social-marks-as-each-brand-requires.md))。

ADR 0043 は「印は黒 1 色で揃える」と決めた。黒はほとんどの社が許しているので、それで
規定に沿えた。ただし**黒を許さない社が 6 つのうち 2 つある**。

- Meta は Facebook の印について、許す形を「Facebook Blue の丸に白い f」と「白い丸に
  透明な f」の 2 つだけに定めている。黒の単色版が無い。「A Facebook Blue logo on a white
  background is our primary logo use」「Do not recolor our logo to your own brand colors」
- はてなは「原則として、データの編集、変更、改変等はせず、そのまま利用してください」。
  単色が許されるのは「カラーのロゴマークを利用することが困難な掲載場所」で、並びを
  揃えたいという理由はそこに当たらない

一方で、Bluesky は**黒でなければならない**。「Use a monochrome (black or white) variant
when displaying alongside other social media icons」と、他社の印と並べるこの用途を名指し
している。つまり「全部をカラーに」も「全部を黒に」も、どこかの社の規定に反する。

## 検討した選択肢

- **案 A: 黒で揃え、黒を許さない社は共有先から外す**
  - Pros: 色の決まりが 1 つで済む
  - Cons: 共有先の顔ぶれを、読み手がどこにいるかではなく印の色で決めることになる。
    日本語の記事ではてブを外すのは、共有先として要るものから外すことになる
- **案 B: すべて各社の正式なカラーで出す**
  - Pros: 色が並んで目を引く
  - Cons: Bluesky の規定 (他社の印と並べるときは単色) に反する。X と Threads はもともと
    黒白しか持たないので、結局黒も混ざる
- **案 C: 社ごとに規定から色を決める。黒を許す社は黒、許さない社だけ正式な色**

## 決定

**案 C を採る。** 6 つを規定どおりに出せるのはこれだけである。

| 共有先   | 色        | 拠り所                                                     |
| -------- | --------- | ---------------------------------------------------------- |
| X        | `#000`    | 「The X logo is black or white」                           |
| Facebook | `#0866ff` | 「Facebook Blue の丸に白い f」が正式な形                   |
| Bluesky  | `#000`    | 他社の印と並べるときは単色                                 |
| Mastodon | `#000`    | 「Use the one color black or white version of the logo」   |
| Threads  | `#000`    | 色の規定が無く、印そのものが黒白で描かれている             |
| はてブ   | `#00a4de` | 「そのまま利用」が原則。単色はカラーが困難な場所に限られる |

- 黒の印は ADR 0043 の `.brand-mark` のまま。色を持つ 2 社だけ、`.brand-mark-facebook` と
  `.brand-mark-hatena-bookmark` を**足して**付ける。色は `brand-marks.css` が 1 か所で持つ
- hover で色を変えないことは黒の印と同じ。色の規則は hover の形も揃えて持ち、黒の規則より
  後ろに置く (詳細度が同じなので、欠けた hover では黒が勝つ)
- **2 社の印は白の上に置く。** f と B! は抜きなので、規定の言う「白い f」は白地が透けて
  成り立っている。共有の一覧は白いパネルなので、いまはそれで足りている
- ADR 0043 の残り (出ていく先の黒と台、Facebook 以外の話) はそのまま

## 帰結 / Consequences

- 良い面: 6 つすべてが規定どおりになる。Facebook とはてブを共有先に置ける
- 悪い面・トレードオフ:
  - 並びに色が 2 つだけ混ざる。揃って見えないのは規定の側の事情として受け入れる
  - **色の値をコード側で持つことになる。** ADR 0043 が案 B を退けた理由 (古びても機械が
    気づかない) をこの 2 社については負う。Facebook の `#0866ff` は Meta のページに数値が
    無く、配布物とよく知られた値から取った
  - 印の形は Simple Icons のもので、各社の配布物そのものではない。Meta とはてなは
    「配布しているロゴを使え」と読める書き方をしている。ほかの社の印と同じ扱いにした
- 検証方法 / 今後の宣言:
  - `brand-marks.test.ts` が、2 つの色の規則が正式な値と hover の形をすべて持ち、黒の規則
    より後ろにあることを固定する
  - `share-menu.test.tsx` が、色のクラスを持つのが Facebook とはてブの印だけであることを
    固定する。ほかに色を付けると Bluesky の規定に当たる
  - 共有先を足すときは、**先にその社が黒を許しているかを確かめる**。許していなければ
    ここの表に足し、`brand-marks.css` に色の規則を足す

## 参考 / More Information

- [ADR 0043](0043-show-social-marks-as-each-brand-requires.md) — 印を黒で揃える決まりと台
- https://www.meta.com/brand/resources/facebook/logo/
- https://brand.hatena.co.jp/hatenabookmark
- https://bsky.social/about/support/branding
- https://joinmastodon.org/branding
- https://www.meta.com/brand/resources/threads/
- https://about.x.com/en/who-we-are/brand-toolkit
