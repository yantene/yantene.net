import { Temporal } from "@js-temporal/polyfill";
import { MathSyntaxError } from "./latex-to-mathml";
import { asDateString, asOptionalString, parseMarkdownDocument } from "./markdown-document";
import type { Root } from "mdast";
import type { IContentStore } from "~/backend/domain/content";
import type {
  IProfileCommandRepository,
  IProfileContentCache,
  IProfileQueryRepository,
  SocialLink,
} from "~/backend/domain/profile";
import { isSocialPlatform, Profile, ProfileName } from "~/backend/domain/profile";

/** コンテンツリポジトリの中でプロフィールが置かれる場所。記事と違って 1 つしか無い。 */
const SOURCE_PATH = "profile.md";

/** 生年月日に許す書式。粒度を落とした `2012-04` のような値は受け取らない。 */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** プロフィールの同期結果。 */
export interface ProfileRefreshResult {
  /** 同期したか。変更が無くて読み飛ばしたときは false。 */
  readonly processed: boolean;
  /** コンテンツリポジトリから `profile.md` が消えたので掃除したか。 */
  readonly deleted: boolean;
  /** 不正なフロントマター等でスキップしたときの理由。 */
  readonly skipped: { path: string; reason: string } | undefined;
}

/** コンテンツ由来のエラー (フロントマター不正等)。infra エラーと区別してスキップ扱いにする。 */
class ProfileContentError extends Error {
  readonly name = "ProfileContentError";
}

/**
 * コンテンツリポジトリ → D1 + R2 のプロフィール同期サービス (ADR 0041)。
 *
 * ツリーから `profile.md` を探し、ハッシュが変わっていれば読み直して、本文の MDAST を
 * R2 に、フロントマターを D1 の 1 行に置く。コンテンツリポジトリから消えていれば両方を掃除する。
 *
 * **全件削除のガードは置かない。** 記事のほうがそれを要るのは、閲覧数と届いた
 * Webmention がコンテンツリポジトリのどこにも無く、消したら戻せないため。プロフィールが持つのは
 * `profile.md` に書いてあることだけなので、間違って消しても push し直せば元に戻る。
 *
 * コンテンツ不正はスキップして結果に記録する。infra 障害 (コンテンツリポジトリ / R2 / D1) は
 * 握りつぶさず throw する (fail-loud)。
 */
export class ProfileRefreshService {
  constructor(
    private readonly content: IContentStore,
    private readonly command: IProfileCommandRepository,
    private readonly query: IProfileQueryRepository,
    private readonly cache: IProfileContentCache,
  ) {}

  async refresh(options: { force?: boolean } = {}): Promise<ProfileRefreshResult> {
    const tree = await this.content.listTree();
    const entry = tree.find((file) => file.path === SOURCE_PATH);
    const storedHash = await this.query.findSourceHash();

    if (entry === undefined) {
      if (storedHash === undefined) return { processed: false, deleted: false, skipped: undefined };
      await this.command.delete();
      await this.cache.delete();
      return { processed: false, deleted: true, skipped: undefined };
    }

    if (options.force !== true && storedHash === entry.hash) {
      return { processed: false, deleted: false, skipped: undefined };
    }

    try {
      await this.sync(entry.hash);
      return { processed: true, deleted: false, skipped: undefined };
    } catch (error) {
      if (error instanceof ProfileContentError) {
        return {
          processed: false,
          deleted: false,
          skipped: { path: SOURCE_PATH, reason: error.message },
        };
      }
      throw error;
    }
  }

  /**
   * 読んで、検証して、書く。
   *
   * **D1 の save を最後に置く。** source_hash が入った時点でプロフィールは「同期済み」に
   * なり、次の refresh は読まずに飛ばす。R2 への書き込みが後ろだと、落ちたときに
   * D1 に行があるのに本文が無い状態で固まり、force を流すまで直らない。
   */
  private async sync(sourceHash: string): Promise<void> {
    const bytes = await this.content.readFile(SOURCE_PATH);
    if (bytes === undefined) {
      // ツリーには在るのに読めない = infra 障害。fail-loud で送出。
      throw new Error(`source file could not be read: ${SOURCE_PATH}`);
    }

    const { frontmatter, mdast } = parseContent(new TextDecoder().decode(bytes));
    const entity = buildProfile(frontmatter, sourceHash);

    await this.cache.putMdast(mdast);
    await this.command.save(entity);
  }
}

/**
 * Markdown を解析する。読めない LaTeX はコンテンツ不正として扱う。
 * それ以外の失敗はパーサの不具合なので、握りつぶさず送出する。
 */
function parseContent(markdown: string): { frontmatter: Record<string, unknown>; mdast: Root } {
  try {
    return parseMarkdownDocument(markdown);
  } catch (error) {
    if (error instanceof MathSyntaxError) throw new ProfileContentError(error.message);
    throw error;
  }
}

/**
 * フロントマターから Profile を組み立てる純関数。
 * 読めない値は {@link ProfileContentError} として送出し、プロフィールごとスキップする。
 */
function buildProfile(frontmatter: Record<string, unknown>, sourceHash: string): Profile {
  const name = asOptionalString(frontmatter.name);
  if (name === undefined) throw new ProfileContentError("frontmatter is missing name");

  const tagline = asOptionalString(frontmatter.tagline)?.trim();
  if (tagline === undefined || tagline.length === 0) {
    throw new ProfileContentError("frontmatter is missing tagline");
  }

  const dateOfBirth = asDateString(frontmatter.dateOfBirth);
  if (dateOfBirth === undefined) {
    throw new ProfileContentError("frontmatter is missing dateOfBirth");
  }

  try {
    return Profile.create({
      name: ProfileName.create(name),
      dateOfBirth: toDateOfBirth(dateOfBirth),
      birthplace: asOptionalString(frontmatter.birthplace)?.trim(),
      tagline,
      socials: readSocials(frontmatter.socials),
      sourceHash,
    });
  } catch (error) {
    if (error instanceof ProfileContentError) throw error;
    // VO 検証・日付パース失敗はコンテンツ不正として扱う。
    throw new ProfileContentError(error instanceof Error ? error.message : String(error));
  }
}

/**
 * 生年月日を読む。
 *
 * **書式と暦の両方を見る。** 粒度を落とした `2012-04` は書式で、`1993-13-45` は暦で
 * 落ちるが、どちらも書き手にとっては「生年月日の書き方を間違えた」1 つの誤りなので、
 * 理由には欄の名前を入れて返す。Temporal がそのまま投げる `invalid RFC 9557 string`
 * だけでは、`profile.md` のどこを直せばよいのか分からない。
 */
function toDateOfBirth(value: string): Temporal.PlainDate {
  if (DATE_PATTERN.test(value)) {
    try {
      return Temporal.PlainDate.from(value);
    } catch {
      // 暦に無い日付。下の throw に合流させる。
    }
  }
  throw new ProfileContentError(
    `frontmatter has unreadable dateOfBirth (expected YYYY-MM-DD): ${value}`,
  );
}

/**
 * 出ていく先を読む。書いていなければ空の並び。
 *
 * **知らない platform はプロフィールごとスキップする。** その 1 件だけを落とすと、
 * 書いた側からは並びが 1 つ減った理由が分からない。絵を持たない先を足したいときは、
 * `components/social/social-links.tsx` に絵を足すのが先になる。
 */
function readSocials(value: unknown): readonly SocialLink[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new ProfileContentError("frontmatter socials is not a list");

  return value.map((entry: unknown) => {
    if (typeof entry !== "object" || entry === null) {
      throw new ProfileContentError(
        `frontmatter socials has a non-mapping entry: ${String(entry)}`,
      );
    }
    const { platform, url, isMe } = entry as Record<string, unknown>;

    if (typeof platform !== "string" || !isSocialPlatform(platform)) {
      throw new ProfileContentError(
        `frontmatter socials has an unknown platform: ${JSON.stringify(platform)}`,
      );
    }
    const resolved = asOptionalString(url);
    if (resolved === undefined) {
      throw new ProfileContentError(`frontmatter socials has no url for ${platform}`);
    }

    // `isMe` は書いていなければ立てない。主張は明示されたときだけ出す。
    return { platform, url: resolved, isMe: isMe === true };
  });
}
