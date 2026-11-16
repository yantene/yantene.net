import type { PublicProfile } from "./profile-view";
import { FALLBACK_PROFILE_NAME, PROFILE_PHOTO } from "~/lib/profile-fallback";

/*
 * 書き手の身元を表す構造化データ (ADR 0048)。
 *
 * **Person を出す場所はすべてここを通す。** `/about`・トップ・記事の 3 か所が同じ `@id` を
 * 名乗ることで、読む側 (検索エンジン) は「同じ 1 人」だと分かる。場所ごとに手で組むと、
 * `@id` の綴りが 1 か所ずれただけで「同じ名前の人が 2 人いる」状態に戻り、しかも画面には
 * 何も出ないので気づけない。
 */

type JsonLdNode = Record<string, unknown>;

/**
 * 書き手の `@id`。**この文字列を組み立てるのはここだけ。**
 *
 * サイトのルートを土台にするのは、そこが動かない場所だから。`@id` は名札であって、
 * 開けるページを指す必要は無い。書き手についてのページ (`/about`) は `url` が指す。
 * `#person` を付けるのは、同じルートを土台にするサイト (`#website`) と人を別の名札で
 * 言い分けるため。**フラグメント無しのルートを人の `@id` にしないこと** (サイトと人が
 * 同じ 1 つの節に合体する)。
 *
 * ⚠️ **一度配ったら動かさない。** 識別子なので、変えると読む側からは別人が現れたことに
 * なる。
 */
export function personId(origin: string): string {
  return `${origin}/#person`;
}

/** サイトの `@id`。書き手 ({@link personId}) と同じルートを土台に、別のフラグメントで名乗る。 */
function websiteId(origin: string): string {
  return `${origin}/#website`;
}

/**
 * サイトへの参照。記事と `/about` が `isPartOf` で「このページはこのサイトの一部」と言う。
 *
 * `@id` だけで指す。サイトの本体 (名前・別名) を言うのはトップの `WebSite` の役で、
 * ページごとに写すと、名前を変えたときに場所によって違うことを言う余地ができる。
 */
export function websiteReference(origin: string): JsonLdNode {
  return { "@id": websiteId(origin) };
}

/**
 * 書き手についてのページ (`/about`) の URL。Person の `url` と、そのページ自身
 * (`ProfilePage`) の `url` が指す先。
 */
function aboutUrl(origin: string): string {
  return `${origin}/about`;
}

/**
 * JSON-LD の `email`。
 *
 * schema.org の Person は連絡先を `email` で受ける。`sameAs` は「その人だと分かる
 * 参照 Web ページ」なので、`mailto:` はあちらではなくこちらに置く。
 *
 * 値は `mailto:` を剥いだアドレスにする。**画面に出ているものより増やさない** —
 * 同じアドレスが同じページに既にリンクとして出ているので、機械が読める形を添えるだけ。
 */
function emailFor(profile: PublicProfile): { email?: string } {
  const account = profile.socials.find((social) => social.platform === "email");
  if (account === undefined) return {};
  return { email: account.url.replace(/^mailto:/, "") };
}

/**
 * JSON-LD の `sameAs`。自分のものだと主張できる先だけを並べる。相互リンクの無い先を
 * 挙げると、確かめた側から見て嘘になる (h-card の `rel="me"` と同じ線引き)。
 *
 * **並べる先が 1 つも無ければ、欄ごと出さない。** 空の `sameAs` は「出ていく先は無い」と
 * 名乗ることになる。
 *
 * ⚠️ **メールはここに入れない。** `sameAs` は schema.org の定義で「その項目の身元を
 * 一意に示す参照 Web ページ」であって、連絡先の置き場ではない。`mailto:` を混ぜると、
 * `sameAs` をプロフィールページとして辿る読み手が開けない URL を掴む。Person には
 * `email` という欄が別にあるので、そちらへ回す ({@link emailFor})。
 */
function sameAsFor(profile: PublicProfile): { sameAs?: readonly string[] } {
  const urls = profile.socials
    .filter((social) => social.isMe && social.platform !== "email")
    .map((social) => social.url);
  return urls.length === 0 ? {} : { sameAs: urls };
}

/**
 * プロフィールから来る欄。**同期されていなければ 1 つも出さない。**
 *
 * 既定値で埋めない。空の `description` は「自己紹介は無い」と名乗ることになり、
 * 同期されたあとの姿と食い違う。
 */
function profileFields(profile: PublicProfile | null): JsonLdNode {
  if (profile === null) return {};
  return {
    description: profile.tagline.join(" "),
    ...sameAsFor(profile),
    ...emailFor(profile),
  };
}

/**
 * 書き手そのもの。`/about` の `mainEntity` とトップの `@graph` が出す。
 *
 * 2 か所が同じ関数から出るので、同じ `@id` の節が場所によって違うことを言わない。
 *
 * プロフィールが同期されていなくても殻 (`@id`・名前・顔・`url`) は立てる。h-card の殻を
 * 残すのと同じ理由で、記事とトップが指している `@id` の先を空にしない。
 *
 * ⚠️ **経歴はここに出さない** (ADR 0044)。`alumniOf` も `award` も `birthDate` も
 * `birthPlace` も `worksFor` も足さないこと。経歴は読み物として画面に出すもので、機械に
 * 名乗る身元の一部ではない (生年月日と出身地を機械が読む形で持たないこと (#508) と同じ
 * 線引き)。
 */
export function personNode(origin: string, profile: PublicProfile | null): JsonLdNode {
  return {
    ...personReference(origin, profile),
    image: `${origin}${PROFILE_PHOTO}`,
    ...profileFields(profile),
  };
}

/**
 * 書き手への参照。記事の `author` / `publisher` が使う。
 *
 * **`@id` だけの裸の参照にはしない。** Google の Article の構造化データは `author` に
 * `name` を求め、`url` を勧めている。記事のページには Person の本体が無いので、裸の
 * 参照だと読む側が `/about` を引くまで筆者の名前が分からない。
 *
 * 詳しいこと (自己紹介・出ていく先) は載せない。それを言うのは本体 (`personNode`) の役で、
 * ここに写すと記事の数だけ同じものを運ぶことになる。
 */
export function personReference(origin: string, profile: PublicProfile | null): JsonLdNode {
  return {
    "@type": "Person",
    "@id": personId(origin),
    name: profile?.name ?? FALLBACK_PROFILE_NAME,
    url: aboutUrl(origin),
  };
}

/**
 * `WebSite` の名前。Google が検索結果の頭に出すサイト名はここから決まる。
 *
 * ⚠️ **翻訳リソース (`meta.title`) から引かない。** あちらは読み手の言語に追従し、英語では
 * `yantene` になる。クローラーは `Accept-Language` を送らないことが多く、既定は英語なので、
 * 引くとサイト名が見る相手によって変わる。サイトの名前は 1 つなので、言語に依らず固定する。
 */
const SITE_NAME = "やんてね";

/** サイトの別名。ドメインで呼ばれることがあるので、そちらでも同じサイトだと分かるようにする。 */
const SITE_ALTERNATE_NAME = "yantene.net";

/**
 * `/about` の構造化データ。ページを `ProfilePage` として名乗り、その主題に書き手を置く。
 *
 * **プロフィールが同期されているときだけ呼ぶ。** 同期の前の `/about` は「準備中」の一枚で
 * `noindex` が立つ。中身の無いページが「これは誰それのプロフィールページだ」と名乗るのは
 * 嘘になる。
 *
 * **ページ自身には `@id` を付けない。** 名札が要るのは、ほかの場所から指されるもの
 * (書き手とサイト) だけ。このページを指す節はどこにも無い。
 */
export function profilePageJsonLd(origin: string, profile: PublicProfile): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    url: aboutUrl(origin),
    isPartOf: websiteReference(origin),
    mainEntity: personNode(origin, profile),
  };
}

/**
 * トップの構造化データ。サイトそのもの (`WebSite`) と、その持ち主 (`Person`) を並べる。
 *
 * 2 つの節を 1 つの `@graph` にまとめる。`buildPageMeta` が受けるのは 1 つのオブジェクトで、
 * 全ページが通る出し口を配列にも対応させるより、渡す側で 1 つにまとめるほうが変える所が
 * 少ない。
 *
 * **プロフィールが同期されていなくても出す。** トップは同期の前から index される
 * ページで、サイト名は同期と関係が無い。Person は殻だけになる (`personNode`)。
 */
export function homeJsonLd(origin: string, profile: PublicProfile | null): JsonLdNode {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": websiteId(origin),
        name: SITE_NAME,
        alternateName: SITE_ALTERNATE_NAME,
        url: `${origin}/`,
        // 本体が同じ `@graph` のすぐ隣にあるので、ここは `@id` だけで指す。
        publisher: { "@id": personId(origin) },
      },
      personNode(origin, profile),
    ],
  };
}
