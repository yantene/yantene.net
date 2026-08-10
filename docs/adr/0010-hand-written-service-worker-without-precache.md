# 0010. Service Worker を手書きし、先回りして蓄えない

- Status: Accepted
- Date: 2026-08-10
- Deciders: @yantene

## Context / 背景

PWA としてインストールできるようにしたい ([#123](https://github.com/yantene/yantene.net/issues/123))。
Chrome がインストール可能と判断するには manifest だけでは足りず、fetch を扱う Service
Worker が要る。あわせて、一度読んだページは電波の無い場所でも開けるようにしたい。

このサイトは React Router の SSR 構成で、ビルドが `build/client` と `build/server` に
分かれる ([0006](0006-react-router-framework-mode.md))。プラグインに precache manifest を
生成させるなら、どの出力を拾うかを設定で調整し続けることになる。

Service Worker には固有の危うさもある。一度登録されると利用者の端末に残り、壊れたものを
配ると回復させる手立てが限られる。配信のされ方も他のコードと違い、`public/` に置いたものは
**ビルドを介さずそのまま配られる**。

## 検討した選択肢

- **案 A: `vite-plugin-pwa` に任せる** — precache manifest の生成まで面倒を見てもらう。
  - Pros: 定石。プリキャッシュにより初回訪問後すぐ全ページがオフラインで開ける。
  - Cons: SSR で二分されたビルド出力に噛み合わせる設定が要り、ビルド構成を変えるたびに
    追随が必要になる。依存が 1 つ増える。
- **案 B: 手書きし、実行時の蓄えだけにする (採用)** — 通ったものを都度蓄える。
  - Pros: SW がビルドから切り離される。数十行で書けて、中身がそのまま読める。
    初回訪問で余分な通信が起きない。
  - Cons: 初めて開くページはオフラインで読めない。

## 決定

案 B を採用する。Service Worker は手書きし、先回りして蓄える (プリキャッシュ) ことはしない。

- **プリキャッシュしない。** ビルドした資材を一括で蓄えるにはファイル名のハッシュを
  Service Worker が知る必要があり、ビルドと SW が噛み合っているかを常に気にすることになる。
  通ったものを都度蓄えるだけにして、SW をビルドから切り離す
- **依存を足さない。** プリキャッシュを捨てれば残るのは実行時の蓄えだけで、数十行で書ける
- **蓄え方は 2 通りだけ。** ファイル名にハッシュが入る資材は蓄えを先に見る (cache-first)、
  ページは通信を先に試す (network-first)。API・フィード・sitemap・原文 Markdown は触らない
- **更新は黙って入れ替える** (`skipWaiting` + `clients.claim`)。読み物のサイトで
  「更新しますか」と尋ねるのは大げさで、直した不具合が届くのも遅れる
- **退く道を残す。** 壊れたものを配ったときのために、蓄えを捨てて自身を登録解除する
  切り替え (`IS_KILL_SWITCH`) を SW 内に持たせる

`public/sw.js` はそのまま配られるため、判断の背景はこの ADR に置き、SW 本体には動作を
追うのに要るだけの注記を残す。

## 帰結 / Consequences

- 良い面: ビルドの構成を変えても Service Worker は影響を受けない。依存が増えず、
  中身がそのまま読める大きさに収まる。初回訪問で余分な通信が起きない。
- 悪い面・トレードオフ:
  - **初めて開くページはオフラインで読めない。** 訪れたことのあるページだけが対象になる
  - 資材が古いまま残りうる。ハッシュ付きの資材は中身が変わらない前提で蓄えるので、
    この前提が崩れる名前 (ハッシュ無しの `/assets/*`) を作らないこと
  - 蓄えの意味を変えるときは `CACHE_VERSION` を上げる必要がある。上げ忘れると古い蓄えが
    新しい規則で使われる
  - `public/` に置くので minify されない。**書いたものはそのまま配られる**
- 検証方法 / 今後の宣言: 転送を経た応答は `cache.put` が拒むため、蓄える前に
  `response.redirected` を除く。オフライン時の案内 (`/offline.html`) も転送されうるので
  `cache.add` ではなく中身を写して入れ直す。

## 参考 / More Information

- [Issue #123](https://github.com/yantene/yantene.net/issues/123)
- 実装: `public/sw.js` / 登録: `app/frontend/lib/register-service-worker.ts`
- [0006](0006-react-router-framework-mode.md)
