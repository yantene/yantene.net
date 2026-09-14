import type { IProfileContentCache } from "~/backend/domain/profile";

const JSON_CONTENT_TYPE = "application/json";

/**
 * プロフィール本文の写しを置くキー。
 *
 * 記事は `articles/<slug>/` の下にまとめるが、こちらは 1 つしか無いので接頭辞を
 * 持たせる意味が無い。`articles/` とは別の名前なので衝突しない。
 */
const MDAST_KEY = "profile/mdast.json";

/** R2 をバックエンドにした {@link IProfileContentCache} 実装。 */
export class R2ProfileContentCache implements IProfileContentCache {
  constructor(private readonly bucket: R2Bucket) {}

  async putMdast(mdast: unknown): Promise<void> {
    await this.bucket.put(MDAST_KEY, JSON.stringify(mdast), {
      httpMetadata: { contentType: JSON_CONTENT_TYPE },
    });
  }

  async getMdast(): Promise<unknown> {
    const object = await this.bucket.get(MDAST_KEY);
    if (object === null) return undefined;
    return JSON.parse(await object.text());
  }

  async delete(): Promise<void> {
    await this.bucket.delete(MDAST_KEY);
  }
}
