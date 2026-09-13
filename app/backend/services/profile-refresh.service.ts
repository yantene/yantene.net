import type { ParsedProfileContent } from "./profile-content-parser";
import type { ImageDimensions } from "./image-dimensions";
import type { ContentEntry, IContentStore } from "~/backend/domain/content";
import type {
  IProfileCommandRepository,
  IProfileContentCache,
  IProfileQueryRepository,
  Profile as ProfileEntity,
} from "~/backend/domain/profile";
import type { IUnpersisted } from "~/backend/domain/shared";
import { contentTypeForPath } from "./asset-content-type";
import { computeContentHash } from "./content-hash";
import { readImageDimensions } from "./image-dimensions";
import { definitionUrlsOf, withAssetUrls, withImageDimensions } from "./mdast-assets";
import { resolveProfileAssetUrl } from "./profile-asset-url";
import { parseProfileContent, ProfileContentError } from "./profile-content-parser";
import { Profile } from "~/backend/domain/profile";
import { ImageUrl } from "~/backend/domain/shared";
import { collectBareLinkUrls } from "~/lib/link-card/bare-link";

/** コンテンツリポジトリの中でプロフィールが置かれる場所。`profile.md` と `profile/<asset>`。 */
const SOURCE_PATH = "profile.md";
const ASSET_PREFIX = "profile/";

/** プロフィールの同期結果。 */
export interface ProfileSyncResult {
  /** 書き直したか。変更が無くて読まなかったときは false。 */
  readonly synced: boolean;
  /** 掃除したか (`profile.md` がコンテンツリポジトリから消えていたとき)。 */
  readonly deleted: boolean;
  /** 読めなくてスキップした理由。読めたときは空。 */
  readonly skipped: { path: string; reason: string }[];
  /** 長い自己紹介が参照しているカード化対象の URL (重複なし)。 */
  readonly linkedUrls: string[];
}

export interface ProfileRefreshOptions {
  /** ハッシュが一致していても読み直す。実装側の変更を既存のプロフィールに反映するとき。 */
  readonly force?: boolean;
}

interface ProfileGroup {
  readonly assets: readonly ContentEntry[];
  readonly contentHash: string;
}

/**
 * コンテンツリポジトリ → D1 + R2 のプロフィール同期サービス。
 *
 * 形は記事の同期と同じ。`profile.md` + `profile/` の合成ハッシュで変更を検出し、
 * 変わっていれば読み直して MDAST と原文とアセットを R2 に、メタデータを D1 に書く。
 * `profile.md` が消えていれば D1 と R2 から掃除する。
 *
 * **「`profile.md` が無い」は事故ではない** (まだ書いていないだけかもしれない) ので、
 * 記事のような件数のガードは持たない。代わりに**ツリーが丸ごと空のときだけ**掃除を拒む。
 * 記事の同期にも同じガードがあるが、あちらは D1 に記事が 1 件も入っていない環境では
 * 発火しないので、こちらを頼りにはできない。
 *
 * コンテンツ不正 (フロントマターが読めない等) はスキップして結果に記録し、**前回
 * 同期した内容を残す**。infra 障害 (コンテンツリポジトリ / R2 / D1) は握りつぶさず throw する
 * (fail-loud)。
 */
export class ProfileRefreshService {
  constructor(
    private readonly content: IContentStore,
    private readonly command: IProfileCommandRepository,
    private readonly query: IProfileQueryRepository,
    private readonly cache: IProfileContentCache,
  ) {}

  async refresh(options: ProfileRefreshOptions = {}): Promise<ProfileSyncResult> {
    const tree = await this.content.listTree();
    const group = groupProfile(tree);
    const stored = await this.query.findSourceHash();

    if (group === undefined) {
      if (stored === undefined) return idle();
      // 空のツリーを「消してよい」の合図として受け取らない。ブランチの取り違えや
      // コンテンツリポジトリ側の事故で何も無い応答が返ると、掃除の経路がそのまま削除になる。
      // 記事の同期の同じガードは D1 に記事が 1 件も入っていない環境では発火しないので、
      // ここでも独立に見る (`profile.md` だけを消したときはツリーに他の中身が在るので通る)。
      if (tree.length === 0) {
        throw new Error("refusing to delete the profile: the content tree is empty");
      }
      // コンテンツリポジトリから消えたら D1 と R2 から掃除する。記事と違って閲覧数のような
      // こちらにしか無いものを持たないので、消しても取り返しがつかないものは無い。
      await this.command.delete();
      await this.cache.deleteProfile();
      return { synced: false, deleted: true, skipped: [], linkedUrls: [] };
    }

    if (options.force !== true && stored === group.contentHash) return idle();

    try {
      return {
        synced: true,
        deleted: false,
        skipped: [],
        linkedUrls: [...(await this.sync(group))],
      };
    } catch (error) {
      if (error instanceof ProfileContentError) {
        // 読めなかったプロフィールは掃除の対象にしない。誤字 1 つで、出ている
        // プロフィールと記事末尾の筆者紹介が消える。
        return {
          synced: false,
          deleted: false,
          skipped: [{ path: SOURCE_PATH, reason: error.message }],
          linkedUrls: [],
        };
      }
      throw error;
    }
  }

  /**
   * プロフィールを同期する。まず読み取り・検証を済ませ、成功したら R2 へ書き、
   * 行き場を失ったアセットを片付け、最後に D1 を更新する。
   *
   * **D1 の upsert を最後に置くのが肝。** contentHash が入った時点で「同期済み」に
   * なり、次の refresh は読まずに飛ばす。だから upsert より前に済ませておかないものは、
   * 失敗しても二度と直らない (記事と同じ決め)。
   */
  private async sync(group: ProfileGroup): Promise<readonly string[]> {
    const bytes = await this.content.readFile(SOURCE_PATH);
    if (bytes === undefined) {
      // ツリーには在るのに読めない = infra 障害。fail-loud で送出。
      throw new Error(`source file could not be read: ${SOURCE_PATH}`);
    }
    const markdown = new TextDecoder().decode(bytes);
    const parsed = parseProfileContent(markdown);
    // 書き始める前に検証を終える。途中で引き返すと、R2 だけが新しい姿になる。
    const profile = buildProfile(group, parsed);

    // アセットを先に処理して寸法を得てから MDAST に埋める (レイアウトシフト対策)。
    const dimensions = await this.cacheAssets(group);
    const linked = withAssetUrls(parsed.mdast, resolveProfileAssetUrl);
    const sized = withImageDimensions(linked, dimensions, definitionUrlsOf(linked));

    await this.cache.putMdast(sized);
    await this.cache.putSource(markdown);
    await this.cache.pruneAssets(assetPathsOf(group));
    await this.command.upsert(profile);

    return collectBareLinkUrls(sized);
  }

  /**
   * アセットを R2 に書き込みつつ、画像の寸法を集めて返す。
   * 読めなかった・寸法を判別できなかったものは表に載せない。
   */
  private async cacheAssets(group: ProfileGroup): Promise<ReadonlyMap<string, ImageDimensions>> {
    const dimensions = new Map<string, ImageDimensions>();
    for (const asset of group.assets) {
      const bytes = await this.content.readFile(asset.path);
      if (bytes === undefined) continue;
      const relPath = asset.path.slice(ASSET_PREFIX.length);
      await this.cache.putAsset(relPath, { bytes, contentType: contentTypeForPath(relPath) });
      const size = readImageDimensions(bytes);
      // キーは解決後の URL。本文の側も同じ解決を通るので、符号化の揺れを気にせず
      // 突き合わせられる (#297)。
      if (size !== undefined) dimensions.set(resolveProfileAssetUrl(`./${relPath}`), size);
    }
    return dimensions;
  }
}

function idle(): ProfileSyncResult {
  return { synced: false, deleted: false, skipped: [], linkedUrls: [] };
}

/** `profile.md` と、その脇の `profile/` 配下をまとめる。無ければ undefined。 */
function groupProfile(tree: readonly ContentEntry[]): ProfileGroup | undefined {
  const source = tree.find((entry) => entry.path === SOURCE_PATH);
  if (source === undefined) return undefined;
  const assets = tree.filter((entry) => entry.path.startsWith(ASSET_PREFIX));
  return { assets, contentHash: computeContentHash(source, assets) };
}

/** プロフィールがコンテンツリポジトリに持っているアセットの相対パス。 */
function assetPathsOf(group: ProfileGroup): ReadonlySet<string> {
  return new Set(group.assets.map((asset) => asset.path.slice(ASSET_PREFIX.length)));
}

/**
 * 解析済みの内容から Profile エンティティを組み立てる純関数。
 * 顔写真の URL がアセット API の形にならなければコンテンツ不正として送出する。
 */
function buildProfile(
  group: ProfileGroup,
  parsed: ParsedProfileContent,
): ProfileEntity<IUnpersisted> {
  try {
    return Profile.create({
      name: parsed.name,
      tagline: parsed.tagline,
      avatarUrl:
        parsed.avatar === undefined
          ? undefined
          : ImageUrl.create(resolveProfileAssetUrl(parsed.avatar)),
      socials: parsed.socials,
      lifeEvents: parsed.lifeEvents,
      sourceHash: group.contentHash,
    });
  } catch (error) {
    // 絶対 URL を書いた avatar はここで落ちる (ImageUrl はルート相対しか受けない)。
    throw new ProfileContentError(error instanceof Error ? error.message : String(error));
  }
}
