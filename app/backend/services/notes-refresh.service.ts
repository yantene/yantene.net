import { Temporal } from "@js-temporal/polyfill";
import { toString as mdastToString } from "mdast-util-to-string";
import { contentTypeForPath } from "./asset-content-type";
import { readImageDimensions, type ImageDimensions } from "./image-dimensions";
import { MathSyntaxError } from "./latex-to-mathml";
import { resolveAssetUrl } from "./note-asset-url";
import {
  parseNoteContent,
  VisibilityValueError,
  type ParsedNoteContent,
} from "./note-content-parser";
import type { Definition, Image, Link, Nodes, Root } from "mdast";
import type { ContentEntry, IContentStore } from "~/backend/domain/content";
import type {
  INoteCommandRepository,
  INoteContentCache,
  INoteQueryRepository,
  INoteSearchIndex,
} from "~/backend/domain/note";
import type { IUnpersisted } from "~/backend/domain/shared";
import {
  ImageUrl,
  Note,
  NoteSlug,
  NoteTag,
  NoteTitle,
} from "~/backend/domain/note";
import { collectBareLinkUrls } from "~/lib/link-card/bare-link";

const noteSourcePattern = /^notes\/[^/]+\.md$/;

/** refresh の実行結果サマリ。 */
export interface RefreshResult {
  /** 再処理した slug。 */
  readonly processed: string[];
  /** 削除した slug (正本から消えたノート)。 */
  readonly deleted: string[];
  /** 非公開の指定により同期しなかった slug。既に載っていたものは deleted にも入る。 */
  readonly unpublished: string[];
  /** 不正なコンテンツ (フロントマター等) でスキップしたファイル。 */
  readonly skipped: { path: string; reason: string }[];
  /**
   * 再処理した記事が参照しているカード化対象の URL (重複なし)。
   *
   * カードの取得はこのサービスの役目ではない (外部サイトに依存するので失敗の扱いが違う)。
   * 誰が何を参照しているかだけを返し、取りに行くかどうかは Composition Root が決める。
   */
  readonly linkedUrls: string[];
}

export interface RefreshOptions {
  /**
   * コンテンツハッシュが一致していても再処理する。
   *
   * 変更検出は md + アセットのハッシュで行うため、**実装側の変更 (MDAST の作り方を変えた等) は
   * 通常の refresh では既存ノートに反映されない**。そうした移行を流すときに使う。
   */
  readonly force?: boolean;
}

interface NoteGroup {
  readonly slug: NoteSlug;
  readonly base: string;
  readonly sourcePath: string;
  readonly assetPrefix: string;
  readonly assets: readonly ContentEntry[];
  /** md + 全アセットのハッシュを合成した変更検出用ハッシュ。 */
  readonly contentHash: string;
}

/** コンテンツ由来のエラー (フロントマター不正等)。infra エラーと区別してスキップ扱いにする。 */
class NoteContentError extends Error {
  readonly name = "NoteContentError";
}

/** 読み取り済みの原文と、その解析結果。読むのは 1 ノートにつき 1 回に留める。 */
interface NoteSource {
  /** フロントマター込みの原文。`/notes/<slug>.md` の配信元として R2 に置く。 */
  readonly markdown: string;
  readonly parsed: ParsedNoteContent;
}

/**
 * 正本 (GitHub) → D1 + R2 のコンテンツ同期サービス。
 *
 * ツリーを取得し、md + アセットの合成ハッシュで変更を検出、変わったノートだけ内容を
 * 読み直して MDAST を R2 にキャッシュ・メタデータを D1 に upsert・画像を R2 にキャッシュ
 * する。正本から消えたノートは D1 / R2 から掃除する (ADR 0004)。
 *
 * コンテンツ不正 (フロントマター欠落等) はそのノートだけをスキップして結果に記録する。
 * スキップしたノートは掃除の対象にせず、前回同期した内容を残す (誤字 1 つで公開中の
 * 記事を消さない)。infra 障害 (正本 / R2 / D1) は握りつぶさず throw する (fail-loud)。
 */
export class NotesRefreshService {
  constructor(
    private readonly content: IContentStore,
    private readonly command: INoteCommandRepository,
    private readonly query: INoteQueryRepository,
    private readonly cache: INoteContentCache,
    private readonly searchIndex: INoteSearchIndex,
  ) {}

  async refresh(options: RefreshOptions = {}): Promise<RefreshResult> {
    const tree = await this.content.listTree();
    const groups = groupNotes(tree);
    const stored = await this.query.listSourceHashes();

    // 空のツリーを「全部消してよい」の合図として受け取らない。ブランチの取り違えや
    // 正本側の事故で notes/ を持たない応答が返ると、掃除の経路がそのまま全件削除に
    // なる。閲覧数も届いた Webmention も正本には無いので、消したら戻せない。
    // 既に何件か載っているのに 1 件も見つからないのは、同期ではなく事故である。
    //
    // 全記事を private にしたときはここに掛からない (非公開のノートもツリーには
    // 在るので groups には入る)。掛かるのは正本の側が空に見えるときだけ。
    if (stored.size > 0 && groups.length === 0) {
      throw new Error(
        `refusing to delete all ${stored.size.toString()} note(s): the content tree has no notes/*.md`,
      );
    }

    const processed: string[] = [];
    const skipped: { path: string; reason: string }[] = [];
    const unpublished: string[] = [];
    const seen = new Set<string>();
    const linkedUrls = new Set<string>();

    // コンテンツ不正はスキップ。infra 障害はここで握りつぶさず再送出する。
    const attempt = async <T>(
      group: NoteGroup,
      work: () => Promise<T>,
    ): Promise<{ ok: true; value: T } | { ok: false }> => {
      try {
        return { ok: true, value: await work() };
      } catch (error) {
        if (error instanceof NoteContentError) {
          skipped.push({ path: group.sourcePath, reason: error.message });
          return { ok: false };
        }
        throw error;
      }
    };

    for (const group of groups) {
      const slug = group.slug.toString();

      // 変更なしは読まずに飛ばす。force のときは実装変更を既存ノートへ反映するため
      // 読み直す。
      //
      // ハッシュが一致するのは前回同期できたノート、つまり前回は公開だったものに限る
      // (非公開なら D1 に載らず、stored に無いので一致しようがない)。visibility を
      // 書き換えれば contentHash も変わるため、公開 → 非公開の切り替えは必ず下に抜ける。
      const isUnchanged = stored.get(slug) === group.contentHash;
      if (options.force !== true && isUnchanged) {
        seen.add(slug);
        continue;
      }

      const source = await attempt(group, () => this.readNote(group));
      if (!source.ok) {
        // 読めなかった理由はコンテンツ不正 (読めない LaTeX / 読めない visibility) に
        // 限られる。infra 障害は attempt が握らずに送出するので、ここには来ない。
        // つまりノート自体は正本に在るので、seen に入れて掃除の対象から外す。
        // 入れ忘れると「正本から消えたノート」と同じ経路で D1・R2 から消え、閲覧数も
        // 届いた Webmention も道連れになる。Webmention は正本のどこにも無いので戻せない。
        //
        // 読み取りの後で落ちる不正 (publishedOn 欠落など) は seen.add より後の
        // buildNoteContent で起きるため元から旧版が残る。この分岐だけが非対称だった。
        seen.add(slug);
        continue;
      }

      // 非公開の記事は seen に入れない。正本から消えたノートと同じ経路で
      // D1 と R2 から掃除され、以後どの配信経路にも現れなくなる。
      // 配信側で除外条件を書き足す方式だと、経路が増えるたびに漏れが起きる。
      if (source.value.parsed.frontmatter.visibility === "private") {
        unpublished.push(slug);
        continue;
      }

      seen.add(slug);
      const synced = await attempt(group, () =>
        this.syncNote(group, source.value),
      );
      if (!synced.ok) continue;
      for (const url of synced.value) linkedUrls.add(url);
      processed.push(slug);
    }

    const deleted = await this.deleteRemoved(stored, seen);
    return {
      processed,
      deleted,
      unpublished,
      skipped,
      linkedUrls: [...linkedUrls],
    };
  }

  /**
   * 原文を読んで解析する。書き込みには進まない。
   *
   * 非公開の判定を syncNote の内側に置くと、書き込みを始めてから引き返すことになる。
   * かといって判定のためだけに読み直すと、公開する記事を 2 度読んで 2 度解析すること
   * になる。読むのはここ 1 回にして、結果を syncNote へ渡す。
   */
  private async readNote(group: NoteGroup): Promise<NoteSource> {
    const bytes = await this.content.readFile(group.sourcePath);
    if (bytes === undefined) {
      // ツリーには在るのに読めない = infra 障害。fail-loud で送出。
      throw new Error(`source file could not be read: ${group.sourcePath}`);
    }
    const markdown = new TextDecoder().decode(bytes);
    return { markdown, parsed: parseContent(markdown) };
  }

  /**
   * 1 ノートを同期する。まず読み取り・検証を済ませ (この間の失敗は content or infra
   * エラーとして送出)、成功したら R2 へ書き、行き場を失ったアセットを片付け、最後に
   * D1 を更新する。
   *
   * **D1 の upsert を最後に置くのが肝。** contentHash が入った時点でそのノートは
   * 「同期済み」になり、次の refresh は読まずに飛ばす。だから upsert より前に済ませて
   * おかないものは、失敗しても二度と直らない。
   *
   * 併せて、本文がカード化対象として参照している URL を返す。
   */
  private async syncNote(
    group: NoteGroup,
    source: NoteSource,
  ): Promise<readonly string[]> {
    // 検証込みでエンティティと MDAST を組み立てる (不正なら NoteContentError)。
    const { note, mdast } = buildNoteContent(group, source.parsed);

    /*
     * **書いてから片付ける。** 先に消す形だと、途中で落ちたときにその記事が消えたまま
     * 残り、D1 に行があるのに R2 に MDAST が無い状態になる (記事ページが 500)。しかも
     * 落ちた原因がファイル名のような固定のものだと、毎回同じ場所で死んで直らない (#310)。
     *
     * 原文と MDAST は鍵が決まっているので上書きで足りる。消す必要があるのは、リネーム
     * ・削除されて**行き場を失ったアセット**だけ。
     */
    // アセットを先に処理して寸法を得てから MDAST に埋める (レイアウトシフト対策)。
    const dimensions = await this.cacheAssets(group);
    const sized = withImageDimensions(
      mdast,
      dimensions,
      definitionUrlsOf(mdast),
    );
    /*
     * 本文の 2 つの姿 (MDAST と原文) は隣り合わせに書く。同じ URL の 2 表現なので
     * (ADR 0020)、間に他の書き込みを挟むと、途中で落ちたときに**記事ページと
     * `/notes/<slug>.md` が違う版を出す**時間が延びる。
     */
    await this.cache.putMdast(group.slug, sized);
    // 原文はそのまま (フロントマター込み) 置く。`/notes/<slug>.md` の配信元になる。
    await this.cache.putSource(group.slug, source.markdown);
    /*
     * 片付けは D1 の upsert より前に置く。後ろだと、片付けに失敗したときに
     * contentHash だけが新しくなり、行き場を失った写しが次の refresh でも拾われない。
     *
     * 残す一覧は「正本にあるアセット」であって「今回書けたもの」ではない。読めなかった
     * アセットまで消すと、一時的な失敗で前回の写しを落とすことになる。
     */
    await this.cache.pruneAssets(group.slug, assetPathsOf(group));
    /*
     * 検索の索引も upsert より前。後ろだと、索引の更新に失敗したときに contentHash
     * だけが新しくなり、**次の refresh がこのノートを読まずに飛ばす**ので索引が古い
     * まま固まる。force を流すまで直らず、直す必要があることも表に出ない。
     */
    await this.searchIndex.index({
      slug: group.slug,
      title: note.title.toString(),
      body: mdastToString(sized),
    });
    await this.command.upsert(note);

    return collectBareLinkUrls(sized);
  }

  /**
   * アセットを R2 に書き込みつつ、画像の寸法を集めて返す。
   * 読めなかった・寸法を判別できなかったものは表に載せない。
   */
  private async cacheAssets(
    group: NoteGroup,
  ): Promise<ReadonlyMap<string, ImageDimensions>> {
    const dimensions = new Map<string, ImageDimensions>();
    for (const asset of group.assets) {
      const bytes = await this.content.readFile(asset.path);
      if (bytes === undefined) continue;
      const relPath = asset.path.slice(group.assetPrefix.length);
      await this.cache.putAsset(group.slug, relPath, {
        bytes,
        contentType: contentTypeForPath(relPath),
      });
      const size = readImageDimensions(bytes);
      /*
       * 鍵は**解決後の URL**。本文の側も同じ resolveAssetUrl を通るので、符号化の
       * 揺れ (`絵.png` → `%E7%B5%B5.png`、`100%25.png` はそのまま) を気にせず突き合わせ
       * られる。URL から名前へ戻す方向だと、`%25` を含む名前が別物に化ける (#297)。
       */
      if (size !== undefined) {
        dimensions.set(resolveAssetUrl(group.slug.toString(), relPath), size);
      }
    }
    return dimensions;
  }

  private async deleteRemoved(
    stored: ReadonlyMap<string, string>,
    seen: ReadonlySet<string>,
  ): Promise<string[]> {
    const deleted: string[] = [];
    for (const slug of stored.keys()) {
      if (seen.has(slug)) continue;
      const noteSlug = NoteSlug.create(slug);
      await this.command.deleteBySlug(noteSlug);
      await this.cache.deleteNote(noteSlug);
      await this.searchIndex.remove(noteSlug);
      deleted.push(slug);
    }
    return deleted;
  }
}

/**
 * ツリーを 1 パスでノード単位 (slug) にまとめる。`notes/<base>.md` を起点にし、
 * `notes/<base>/` 配下のエントリをそのアセットとして束ねる。合成ハッシュも算出する。
 */
function groupNotes(tree: readonly ContentEntry[]): NoteGroup[] {
  const sources: { base: string; entry: ContentEntry }[] = [];
  const assetsByPrefix = new Map<string, ContentEntry[]>();

  for (const entry of tree) {
    if (noteSourcePattern.test(entry.path)) {
      sources.push({
        base: entry.path.slice("notes/".length, -".md".length),
        entry,
      });
    } else if (entry.path.startsWith("notes/")) {
      const prefixEnd = entry.path.indexOf("/", "notes/".length);
      if (prefixEnd === -1) continue;
      const prefix = entry.path.slice(0, prefixEnd + 1);
      const list = assetsByPrefix.get(prefix) ?? [];
      list.push(entry);
      assetsByPrefix.set(prefix, list);
    }
  }

  const groups: NoteGroup[] = [];
  for (const { base, entry } of sources) {
    let slug: NoteSlug;
    try {
      slug = NoteSlug.create(base);
    } catch {
      continue; // slug にできないファイル名は対象外
    }
    const assetPrefix = `notes/${base}/`;
    const assets = assetsByPrefix.get(assetPrefix) ?? [];
    groups.push({
      slug,
      base,
      sourcePath: entry.path,
      assetPrefix,
      assets,
      contentHash: computeContentHash(entry, assets),
    });
  }
  return groups;
}

/** そのノートが正本に持っているアセットの相対パス。 */
function assetPathsOf(group: NoteGroup): ReadonlySet<string> {
  return new Set(
    group.assets.map((asset) => asset.path.slice(group.assetPrefix.length)),
  );
}

/** md + アセットの (path, hash) を合成した変更検出用ハッシュ。 */
function computeContentHash(
  source: ContentEntry,
  assets: readonly ContentEntry[],
): string {
  const sortedAssets = assets.toSorted((a, b) => a.path.localeCompare(b.path));
  const parts = [`${source.path}:${source.hash}`];
  for (const asset of sortedAssets) {
    parts.push(`${asset.path}:${asset.hash}`);
  }
  return fnv1a(parts.join("\n"));
}

/** FNV-1a 32-bit ハッシュ (16 進)。変更検出用途に十分。 */
function fnv1a(input: string): string {
  let hash = 0x81_1c_9d_c5;
  for (const ch of input) {
    hash ^= ch.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 0x01_00_01_93);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Markdown を解析する。読めない LaTeX と読めない visibility はコンテンツ不正として
 * 扱い、そのノートだけをスキップの対象にする (誤字 1 つで refresh 全体を落とさない)。
 * それ以外の失敗はパーサの不具合なので、握りつぶさず送出する。
 */
function parseContent(markdown: string): ParsedNoteContent {
  try {
    return parseNoteContent(markdown);
  } catch (error) {
    if (
      error instanceof MathSyntaxError ||
      error instanceof VisibilityValueError
    ) {
      throw new NoteContentError(error.message);
    }
    throw error;
  }
}

/**
 * 解析済みの本文から Note エンティティと MDAST を組み立てる純関数。
 * 不正なフロントマター・VO 検証失敗は {@link NoteContentError} として送出する。
 */
function buildNoteContent(
  group: NoteGroup,
  parsed: ParsedNoteContent,
): { note: Note<IUnpersisted>; mdast: Root } {
  const slug = group.slug.toString();

  const publishedRaw = parsed.frontmatter.publishedOn;
  if (publishedRaw === undefined) {
    throw new NoteContentError("frontmatter is missing publishedOn");
  }

  try {
    const publishedOn = Temporal.PlainDate.from(publishedRaw);
    const lastModifiedOn = Temporal.PlainDate.from(
      parsed.frontmatter.lastModifiedOn ?? publishedRaw,
    );
    const imageUrl =
      parsed.frontmatter.imageUrl === undefined
        ? undefined
        : ImageUrl.create(resolveAssetUrl(slug, parsed.frontmatter.imageUrl));
    const note = Note.create({
      slug: group.slug,
      title: NoteTitle.create(parsed.frontmatter.title ?? group.base),
      summary: parsed.summary,
      imageUrl,
      tags: parsed.frontmatter.tags.map((tag) => NoteTag.create(tag)),
      publishedOn,
      lastModifiedOn,
      sourceHash: group.contentHash,
    });

    // 本文中の相対 URL をアセット API URL に解決してからキャッシュする (ADR 0005)。
    return { note, mdast: withAssetUrls(parsed.mdast, slug) };
  } catch (error) {
    if (error instanceof NoteContentError) throw error;
    // VO 検証・日付パース失敗はコンテンツ不正として扱う。
    throw new NoteContentError(
      error instanceof Error ? error.message : String(error),
    );
  }
}

/** URL を持ち、アセットを指しうるノードの種別。 */
const assetUrlTypes: ReadonlySet<Nodes["type"]> = new Set([
  "image",
  "link",
  "definition",
]);

/**
 * アセットの相対 URL を持ちうるノードか。
 *
 * 直書き (`image` / `link`) と、参照記法の行き先を持つ `definition` が対象。
 * **画像参照とリンク参照で扱いを分けない。** 以前は画像参照から指された定義だけを
 * 直しており、`[曲][tune]` + `[tune]: ./song.mid` と書くと解決されずに 404 していた。
 * 同じことを `[曲](./song.mid)` と書けば通るので、書き方で結果が変わっていた (#295)。
 *
 * 分けても守りにはならない。resolveAssetUrl は絶対 URL・ルート相対・同一文書参照を
 * 素通しするので、`[x]: https://example.com` や `[x]: /notes/other` のような定義は
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
 * リンクを張るため。`resolveAssetUrl` は絶対 URL とルート相対を素通しするので、外部リンクも
 * 記事間リンク (`/notes/...`) も触られない。書き換わるのは `./foo.mid` のような相対パス。
 *
 * ⚠️ **素の相対パスもアセット扱いになる。** `[前の記事](other-note)` は
 * `/api/v1/notes/<slug>/assets/other-note` になり 404 する。記事間のリンクはルート相対
 * (`/notes/other`) で書くこと。参照記法もこれに揃った (#295) ので、`[prev]: other-note`
 * のように書いていた定義は同じ角に当たる。
 *
 * `link` は子を持つので、URL を直したうえで中まで降りる (リンクで包んだ画像がある)。
 *
 * 生 HTML の中は直さない。`html` ノードが持つのは文字列で、属性を読むには HTML を
 * 解析し直すことになる。本文に直接書く `<audio>` の src は、ルート相対の絶対パスで
 * 書いてもらう (ADR 0022)。
 */
function withAssetUrls<T extends Nodes>(node: T, slug: string): T {
  const resolved: T = isAssetUrlNode(node)
    ? { ...node, url: resolveAssetUrl(slug, node.url) }
    : node;

  if (!("children" in resolved)) return resolved;
  // 子の種別は写しても変わらないので、親の型はそのまま保たれる。
  return {
    ...resolved,
    children: resolved.children.map((child) => withAssetUrls(child, slug)),
  };
}

/**
 * 定義の名前から、解決後の URL を引く表。参照記法の寸法を引くのに使う。
 *
 * **同じ名前が並んだら先に書いたほうが勝つ。** mdast-util-to-hast が
 * `if (!map.has(id))` で先勝ちにしており (CommonMark の定義の扱いに合わせている)、
 * ここが後勝ちだと**描かれる画像と埋めた寸法が別物になる。**
 *
 * 名前はそのまま鍵にしてよい。mdast は `identifier` を参照側も定義側も小文字に均して
 * おり (`label` が書いたままを持つ)、あちらが両側を大文字に揃えているのと同じことに
 * なる。
 */
function definitionUrlsOf(node: Nodes): ReadonlyMap<string, string> {
  const urls = new Map<string, string>();
  collectDefinitionUrls(node, urls);
  return urls;
}

function collectDefinitionUrls(node: Nodes, urls: Map<string, string>): void {
  if (node.type === "definition" && !urls.has(node.identifier))
    urls.set(node.identifier, node.url);
  if (!("children" in node)) return;
  for (const child of node.children) collectDefinitionUrls(child, urls);
}

/**
 * そのノードが指す画像の URL。寸法を持たせる対象でなければ undefined。
 *
 * 直書き (`image`) は自分の URL、参照記法 (`imageReference`) は定義の URL を見る。
 */
function sizedUrlOf(
  node: Nodes,
  definitionUrls: ReadonlyMap<string, string>,
): string | undefined {
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
 * 表の鍵は解決後の URL なので、ノードの URL をそのまま引くだけでよい (cacheAssets)。
 * URL は {@link withAssetUrls} を通った後のものを渡すこと。
 *
 * **参照記法 (`![alt][id]`) では、寸法を載せる先が定義ではなく参照の側になる。**
 * mdast-util-to-hast の imageReference ハンドラは、定義から URL と alt だけを引いて
 * `img` を組み、`applyData` を当てるのは参照の側である。定義に載せても読む者がいない
 * (#296)。
 */
function withImageDimensions<T extends Nodes>(
  node: T,
  dimensions: ReadonlyMap<string, ImageDimensions>,
  definitionUrls: ReadonlyMap<string, string>,
): T {
  const url = sizedUrlOf(node, definitionUrls);
  const size = url === undefined ? undefined : dimensions.get(url);

  const sized: T =
    size === undefined
      ? node
      : {
          ...node,
          data: {
            ...node.data,
            hProperties: {
              ...node.data?.hProperties,
              width: size.width,
              height: size.height,
            },
          },
        };

  if (!("children" in sized)) return sized;
  return {
    ...sized,
    children: sized.children.map((child) =>
      withImageDimensions(child, dimensions, definitionUrls),
    ),
  };
}
