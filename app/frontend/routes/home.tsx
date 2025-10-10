import { hc } from "hono/client";
import { app } from "~/backend";
import type { Route } from "./+types/home";

/**
 * [React Router] meta関数
 *
 * 用途: ページのメタデータ（<title>, <meta>タグ）を動的に設定
 * 実行環境: サーバー側（SSR時）とクライアント側（SPA遷移時）の両方
 *
 * いつ使う:
 * - SEO対策が必要なページ（検索エンジンにインデックスさせたい）
 * - ページごとに異なるタイトルや説明文を表示したい
 * - OGP（SNSシェア時の画像・説明）を設定したい
 *
 * 使わない場合:
 * - 全ページ共通のメタデータ → root.tsxで設定
 * - 動的なメタデータが不要 → 静的なHTMLで十分
 */
export function meta(_args: Route.MetaArgs) {
  return [
    { title: "New React Router App" },
    { name: "description", content: "Welcome to React Router!" },
  ];
}

/**
 * [React Router] loader関数
 *
 * 用途: サーバー側でデータを取得し、SSR（Server-Side Rendering）する
 * 実行環境: サーバー側のみ（Cloudflare Workers）
 * 実行タイミング: 初回ページ読み込み時、またはサーバー側でのページ遷移時
 *
 * いつ使う:
 * - SEOが重要な公開データ（全ユーザー共通のデータ）
 * - 初回表示を高速化したい（データ込みのHTMLを返す）
 * - CDNでキャッシュ可能なデータ
 *
 * 使わない場合:
 * - ユーザー認証が必要なデータ → clientLoaderを使う（CDNキャッシュの問題を回避）
 * - リアルタイム性が求められるデータ → clientLoaderを使う
 * - SEOが不要なデータ → clientLoaderのみで十分
 *
 * 注意: loader の結果はCDNでキャッシュされる可能性がある
 */
export async function loader({ context }: Route.LoaderArgs) {
  // Hono app.request(): サーバー内部でAPIを直接呼び出し（HTTP経由せず高速）
  const response = await app.request(
    "/api/v1/message",
    {},
    context.cloudflare.env,
  );
  const data = (await response.json()) as { message: string };

  return {
    env: context.cloudflare.env.APP_ENV,
    serverMessage: data.message,
  };
}

/**
 * [React Router] clientLoader関数
 *
 * 用途: ブラウザ側でデータを取得し、CSR（Client-Side Rendering）する
 * 実行環境: ブラウザのみ
 * 実行タイミング:
 * - hydrate=true: 初回ページ読み込み時 + ページ遷移時
 * - hydrate=false: ページ遷移時のみ
 *
 * いつ使う:
 * - ユーザー認証が必要なデータ（CDNキャッシュされると危険）
 * - リアルタイム性が求められるデータ
 * - ユーザー固有のデータ（ダッシュボード、プロフィール等）
 * - 従来のuseEffectでのデータフェッチを置き換える
 *
 * 使わない場合:
 * - SEOが重要な公開データ → loaderを使う
 * - ユーザー操作後のデータ更新 → useFetcher()を使う
 * - リアルタイム更新（WebSocket等） → useEffectを使う
 *
 * メリット:
 * - ページ遷移開始と同時にfetch開始（useEffectより高速）
 * - ローディング・エラー状態をReact Routerが自動管理
 * - 型安全性（Hono RPCとの組み合わせ）
 *
 * 重要: clientLoaderが定義されている場合の挙動
 * - コンポーネントに渡される loaderData は clientLoader の戻り値で上書きされる
 * - loader のデータも使いたい場合は、必ず serverLoader() を呼んでスプレッド演算子で展開すること
 * - serverLoader() を呼ばないと loader のデータは消える
 */
export async function clientLoader({ serverLoader }: Route.ClientLoaderArgs) {
  // serverLoader(): 同じファイル内の loader() 関数を呼び出す
  // - SSR時: サーバーで既に実行済みの結果を再利用（再実行しない）
  // - SPA遷移時: HTTP経由でサーバー側の loader() を実行
  const serverData = await serverLoader();

  // Hono RPC: HTTP経由でAPIを呼び出し（Cookie等が自動送信される）
  const client = hc<typeof app>(window.location.origin);
  const response = await client.api.v1.message.$get();
  const data = await response.json();

  // loader と clientLoader のデータを統合して返す
  return {
    ...serverData, // ← これを削除すると loader のデータ（env, serverMessage）が消える
    clientMessage: data.message,
    fetchedAt: new Date().toLocaleTimeString(),
  };
}

// hydrate = true: 初回読み込み時もclientLoaderを実行（最新データを取得）
// hydrate = false: SPA遷移時のみ実行（初回はloaderのデータのみ使用）
clientLoader.hydrate = true;

/**
 * [React] コンポーネント関数
 *
 * 用途: UIを定義し、loaderDataを元に画面を表示する
 * 実行環境: サーバー側（SSR時）とブラウザ側（hydration後）の両方
 *
 * Route.ComponentProps:
 * - loaderData: loader/clientLoaderが返したデータ（型安全に推論される）
 * - params: URLパラメータ（例: /users/:id の id）
 * - など
 *
 * いつ使う:
 * - 取得したデータを画面に表示する
 * - ユーザー操作（クリック等）に応じてUIを更新する
 *
 * 使わない場合:
 * - データフェッチ → loader/clientLoaderで行う
 * - 副作用（データ取得、タイマー等） → useEffectやloaderで行う
 */
export default function Home({ loaderData }: Route.ComponentProps) {
  return (
    <div className="space-y-4 p-4">
      <div>
        <h2 className="font-bold">Environment:</h2>
        <p>env: {loaderData.env}</p>
      </div>

      <div>
        <h2 className="font-bold">Server-side (SSR):</h2>
        <p>message: {loaderData.serverMessage}</p>
      </div>

      {/*
        [React] 条件付きレンダリング

        なぜこのチェックが必要？
        - サーバー側: loaderのみ実行 → clientMessageは存在しない
        - ブラウザ側: clientLoaderも実行 → clientMessageが追加される

        このパターンはSSR + CSRのハイブリッドで頻出
      */}
      {"clientMessage" in loaderData && (
        <div>
          <h2 className="font-bold">Client-side (CSR):</h2>
          <p>message: {loaderData.clientMessage}</p>
          <p className="text-gray-600 text-sm">
            fetched at: {loaderData.fetchedAt}
          </p>
        </div>
      )}
    </div>
  );
}
