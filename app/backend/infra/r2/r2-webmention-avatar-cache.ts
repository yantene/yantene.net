import type { IWebmentionAvatarCache, WebmentionAvatar } from "~/backend/domain/webmention";

const DEFAULT_CONTENT_TYPE = "application/octet-stream";

/** R2 をバックエンドにした {@link IWebmentionAvatarCache} 実装。 */
export class R2WebmentionAvatarCache implements IWebmentionAvatarCache {
  constructor(private readonly bucket: R2Bucket) {}

  private key(id: string): string {
    return `webmentions/avatars/${id}`;
  }

  async put(id: string, avatar: WebmentionAvatar): Promise<void> {
    await this.bucket.put(this.key(id), avatar.bytes as ArrayBufferView, {
      httpMetadata: { contentType: avatar.contentType },
    });
  }

  async get(id: string): Promise<WebmentionAvatar | undefined> {
    const object = await this.bucket.get(this.key(id));
    if (object === null) return undefined;
    return {
      bytes: new Uint8Array(await object.arrayBuffer()),
      contentType: object.httpMetadata?.contentType ?? DEFAULT_CONTENT_TYPE,
    };
  }
}
