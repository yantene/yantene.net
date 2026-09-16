# 0043. 出ていく先の絵は黒 1 色で、不透明な台の上に出す

- Status: Accepted
- Date: 2026-09-16
- Deciders: @yantene

## Context / 背景

トップ・`/about`・記事末尾に、GitHub / X / Bluesky / Mastodon / Discord へ出ていく絵を
並べている ([ADR 0041](0041-keep-the-profile-in-the-content-repository.md))。素材は
Simple Icons (react-icons/si) で、置き場所ごとに `linkClassName` で色と大きさを渡していた。

これが 3 つの点で各社のブランド規定に反していた。

### 1. 絵をサイトの配色で染めていた

`text-foreground/85` を渡していたので、絵は `rgb(26 39 64 / 0.85)` の紺で塗られていた。
各社の規定は揃って「黒か白以外に染めるな」と言っている。

- GitHub「The Invertocat and our wordmark should only appear in white, black, or in few
  cases grey or green」「Don't mix the color of the logo」
- Bluesky は Don't に「Recolor the logo (other than the approved black and white variants)」
- X「The X logo is black or white」「Logo should be white on black background or black on
  white background」。加えて「Strict compliance with these Guidelines is required at all
  times, and any use of the X brands in violation of these Guidelines will **automatically
  terminate** any permission related to your use of the X brands」
- Discord「Please do not edit, change, distort, recolor, or reconfigure the Discord logo」

### 2. 抜きに背景が透けていた

GitHub の猫・Mastodon の m・Discord の目は抜き (negative space) なので、後ろの色が
そのまま入る。トップのヒーローの空は 1 日かけて 昼 → 夕 → 夜 → 朝 と色が変わるため
(`celestim-veiled-sky-cycle`)、**猫の色が時刻によって変わっていた**。

GitHub は「Don't place the logo over busy backgrounds」「Don't use backgrounds that
provide insufficient contrast」と明記している。

### 3. 安全余白が揃っていなかった

Simple Icons はどの絵も 24×24 の箱いっぱいに描く決まりで、GitHub は直径 24 の真円。
並べると 1 つだけ塊が大きく見える。実測した塗りの面積比は GitHub 0.43 / X 0.25 /
Bluesky 0.59 / Mastodon 0.60 / Discord 0.54。

## 検討した選択肢

- **案 A: 不透明な白い円の台に、黒 1 色の絵を載せる** — 台は `--color-base-100`。
  - Pros: 黒はどの社も明示的に許している。台の色が 1 つで済む。白地のページ
    (`/about`・記事末尾) では台が地に溶けるので、見た目はほぼ変わらない
  - Cons: ヒーローでは白丸が 5 つ並ぶ。抑えた線画の景色に、やや UI 然としたものが載る
- **案 B: 各社のブランド色の台に、絵を白抜きで載せる** — GitHub 黒 / X 黒 / Bluesky 青 /
  Mastodon 紫 / Discord 藍。
  - Pros: 規定にいちばん忠実。抜きの中も必ず指定色になる。ヒーローの景色にはよく馴染む
  - Cons: **色の表をコード側で保守し続けることになる。** Bluesky の値は Simple Icons が
    `#1185FE`、公式の現行が `#0560FF` で既に食い違っている。X も `#1DA1F2` から黒へ
    変わった前例がある。古びても機械は気づかない。加えて記事末尾で、名乗りの中で
    いちばん強いはずの名前より出ていく先が重くなる
- **案 C: 既定は白い台で、hover のときだけブランド色にする**
  - Pros: 普段は静かで、触ったときだけ本来の色が出る
  - Cons: 既定の姿がヒーローでは案 A と同じなので、案 A の短所は何も解消しない。
    色の表を保守する義務は案 B と同じだけ負う

## 決定

**案 A を採る。**

- 絵は `#000`。**サイトの配色トークン (`--color-base-content`) に寄せない**
- 台は `--color-base-100` の不透明な円。`2em` 固定
- 絵は `0.86em` に、種類ごとの光学補正 (GitHub 0.88 / X 1.06 / Mastodon 0.94) を掛ける
- hover と `:active` で染めるのは**台であって絵ではない**
- 色は `brand-marks.css` が**サイト全体で 1 か所**持つ (`.brand-mark`)。台と寸法は
  `social-links.css`。**置き場所は大きさしか渡せない**

決め手は Bluesky の規定である。**「Use a monochrome (black or white) variant when
displaying alongside other social media icons」** と、まさにこの用途を名指ししている。
案 B は規定に忠実だが、忠実さを保ち続ける責任をこちらが負う形になる。

クリアスペースの数値 (Bluesky「ロゴと同じ幅を四方に」、Mastodon「36px」) は守らない。
守るとアイコン 1 つが 3 倍の場所を取る。Bluesky は「SNS アイコンとして使うぶんには
許可不要」と別枠を設けており、そちらに拠る。

## 帰結 / Consequences

- 良い面: 規定に沿う。抜きの色が時刻で変わらなくなる。色を決める場所が 1 つになり、
  置き場所ごとに違う色に散らばらない
- 悪い面・トレードオフ:
  - ヒーローでは白丸が 5 つ並ぶ。景色に載せるものとしては案 B のほうが馴染んでいた
  - 記事末尾で絵が黒くなり、以前 (base-content の 55%) より重い。名乗りの中の序列は
    そのぶん詰まる。黒は規定の要求なので、ここは受け入れる
  - 台を敷いたぶん絵と絵の間が広がる。gap は置き場所ごとに詰め直した
- 検証方法 / 今後の宣言: 2 つの検査で固定する。

  `brand-marks.test.ts` は置き場所によらない話を見る。色の規則が黒を指していること・
  サイトの配色トークンを使っていないこと・hover で色が変わらないこと・
  **`react-icons/si` を使っている全ファイルの印に `brand-mark` が付いていること**・
  印を置いているファイルの顔ぶれが変わっていないこと。新しい場所に印を足した人は、
  最後の 1 つで必ず落ちる。

  ⚠️ **表から引いて `<Icon />` で描くファイル (social-links.tsx・share-menu.tsx) は、
  1 つずつの照合ができない。** そこは「ファイルが `brand-mark` に一度も触れていない」
  状態だけを落とす。

  `social-links.test.ts` は台と寸法を見る。台が不透明であること・`socialPlatforms` の
  全種別に光学補正の段階があること・いちばん大きい絵でも台の縁まで絵の半分以上空くこと・
  押下時の打ち消しが `press-control` に勝つ詳細度を持つこと。

  ⚠️ **最後の 1 つは実際に踏んだ穴である。** `.social-link:active { opacity: 1 }` は
  `.press-control:active { opacity: 0.6 }` と詳細度が並び (どちらも 0,2,0)、
  `interaction.css` のほうが app.css で後に import されるので**黙って負けていた**。
  要素で 1 つ上げて (`a.social-link:active`)、順序によらず勝つようにしてある。

## Facebook は黒を許していないので、共有先から外した

**この決定は「黒で揃える」だが、黒を許さない会社もある。** Meta は Facebook の印について
許す形を 2 つだけ定めている。

- 「Our primary expression of the logo is in Facebook Blue with a white 'f'」
- 「Our secondary expression of the logo is in white with a transparent 'f'」
- Don't に「Do not recolor our logo to your own brand colors」

**黒の単色版が無い。** 共有メニューは白いパネルなので、白 + 透明な f は消えてしまう。
残る合法な形は青い丸だけで、他が黒で揃うなかで Facebook だけ色が付くことになる。

**共有先から外した。** 使わなければ違反しようが無く、保守する色も減る。このサイトの
出ていく先 (プロフィール) に Facebook は元から無く、共有先にだけあった。

同じ性質の印を足すときは、`brand-marks.css` に黒で並べれば済む話ではない。**先に
その会社が黒を許しているかを確かめること。**

## 参考 / More Information

- [ADR 0041](0041-keep-the-profile-in-the-content-repository.md) — プロフィールと出ていく先の持ち方
- https://brand.github.com/foundations/logo
- https://bsky.social/about/support/branding
- https://joinmastodon.org/branding
- https://discord.com/branding
- https://about.x.com/en/who-we-are/brand-toolkit (実体は「Brand Quick Guide」の PDF)
- https://www.meta.com/brand/resources/facebook/logo/
- https://github.com/dcurtis/markdown-mark — Markdown の印。public domain なので規定では
  ないが「When possible, please display the mark in a shade of gray, white, or black」と
  あるので、同じ `brand-mark` に乗せてある (以前は hover で primary に変わっていた)
