import type { ImageDimensions } from "./image-dimensions";
import type { Definition, Image, Link, Nodes } from "mdast";
import { mapTree } from "./mdast-tree";

/*
 * 本文の MDAST に、アセットの在り処と大きさを行き渡らせる。
 *
 * 記事もプロフィールも、書くときは `./cover.png` のような相対パスで、配るときは
 * アセット API の URL になる。どちらに解決するかだけが違うので、解決の関数を受け取る。
 */

/** URL を持ち、アセットを指しうるノードの種別。 */
const assetUrlTypes: ReadonlySet<Nodes["type"]> = new Set(["image", "link", "definition"]);

/**
 * アセットの相対 URL を持ちうるノードか。
 *
 * 直書き (`image` / `link`) と、参照記法の行き先を持つ `definition` が対象。
 * **画像参照とリンク参照で扱いを分けない。** 以前は画像参照から指された定義だけを
 * 直しており、`[曲][tune]` + `[tune]: ./song.mid` と書くと解決されずに 404 していた。
 * 同じことを `[曲](./song.mid)` と書けば通るので、書き方で結果が変わっていた (#295)。
 *
 * 分けても守りにはならない。解決の関数は絶対 URL・ルート相対・同一文書参照を
 * 素通しするので、`[x]: https://example.com` や `[x]: /articles/other` のような定義は
 * どちらの扱いでも触られない。
 */
function isAssetUrlNode(node: Nodes): node is Definition | Image | Link {
  return assetUrlTypes.has(node.type);
}

/**
 * 木を写しながら、アセットの相対 URL をアセット API の URL に直す。元の木は変えない。
 *
 * 対象は {@link isAssetUrlNode} が答える (`image` / `link` / `definition`)。
 *
 * `link` を含めるのは、画像として貼れないアセット (曲の MIDI ファイルなど) へ本文から
 * リンクを張るため。解決の関数は絶対 URL とルート相対を素通しするので、外部リンクも
 * 記事間リンク (`/articles/...`) も触られない。書き換わるのは `./foo.mid` のような相対パス。
 *
 * ⚠️ **素の相対パスもアセット扱いになる。** `[前の記事](other-article)` は
 * `/api/v1/articles/<slug>/assets/other-article` になり 404 する。記事間のリンクはルート相対
 * (`/articles/other`) で書くこと。参照記法もこれに揃った (#295) ので、`[prev]: other-article`
 * のように書いていた定義は同じ角に当たる。
 *
 * `link` は子を持つので、URL を直したうえで中まで降りる (リンクで包んだ画像がある)。
 *
 * 生 HTML の中は直さない。`html` ノードが持つのは文字列で、属性を読むには HTML を
 * 解析し直すことになる。本文に直接書く `<audio>` の src は、ルート相対の絶対パスで
 * 書いてもらう (ADR 0022)。
 */
export function withAssetUrls<T extends Nodes>(node: T, resolve: (url: string) => string): T {
  return mapTree(node, (child) => {
    if (!isAssetUrlNode(child)) return child;
    const url = resolve(child.url);
    // 変わらなければ写さない。ルート相対や絶対 URL はそのまま返ってくる。
    return url === child.url ? child : { ...child, url };
  });
}

/**
 * 定義の名前から、解決後の URL を引く表。参照記法の寸法を引くのに使う。
 *
 * **同じ名前が並んだら先に書いたほうが勝つ。** mdast-util-to-hast が
 * `if (!map.has(id))` で先勝ちにしており (CommonMark の定義の扱いに合わせている)、
 * ここが後勝ちだと**描かれる画像と埋めた寸法が別物になる。**
 *
 * 名前はそのままキーにしてよい。mdast は `identifier` を参照側も定義側も小文字に均して
 * おり (`label` が書いたままを持つ)、あちらが両側を大文字に揃えているのと同じことに
 * なる。
 */
export function definitionUrlsOf(node: Nodes): ReadonlyMap<string, string> {
  const urls = new Map<string, string>();
  collectDefinitionUrls(node, urls);
  return urls;
}

function collectDefinitionUrls(node: Nodes, urls: Map<string, string>): void {
  if (node.type === "definition" && !urls.has(node.identifier)) urls.set(node.identifier, node.url);
  if (!("children" in node)) return;
  for (const child of node.children) collectDefinitionUrls(child, urls);
}

/**
 * そのノードが指す画像の URL。寸法を持たせる対象でなければ undefined。
 *
 * 直書き (`image`) は自分の URL、参照記法 (`imageReference`) は定義の URL を見る。
 */
function sizedUrlOf(node: Nodes, definitionUrls: ReadonlyMap<string, string>): string | undefined {
  if (node.type === "image") return node.url;
  if (node.type === "imageReference") {
    return definitionUrls.get(node.identifier);
  }
  return undefined;
}

/**
 * 木を写しながら、画像に width/height を埋める (レイアウトシフト対策)。元の木は変えない。
 *
 * `data.hProperties` は mdast-util-to-hast が要素の属性に展開する仕組みなので、
 * フロント側の変更なしに `<img width height>` が出るようになる。寸法が取れなかった
 * 画像には何も付けない (誤った値で見た目を壊さない)。
 *
 * 表のキーは解決後の URL なので、ノードの URL をそのまま引くだけでよい。
 * URL は {@link withAssetUrls} を通った後のものを渡すこと。
 *
 * **参照記法 (`![alt][id]`) では、寸法を載せる先が定義ではなく参照の側になる。**
 * mdast-util-to-hast の imageReference ハンドラは、定義から URL と alt だけを引いて
 * `img` を組み、`applyData` を当てるのは参照の側である。定義に載せても読む者がいない
 * (#296)。
 */
export function withImageDimensions<T extends Nodes>(
  node: T,
  dimensions: ReadonlyMap<string, ImageDimensions>,
  definitionUrls: ReadonlyMap<string, string>,
): T {
  return mapTree(node, (child) => {
    const url = sizedUrlOf(child, definitionUrls);
    const size = url === undefined ? undefined : dimensions.get(url);
    if (size === undefined) return child;

    return {
      ...child,
      data: {
        ...child.data,
        hProperties: {
          ...child.data?.hProperties,
          width: size.width,
          height: size.height,
        },
      },
    };
  });
}
