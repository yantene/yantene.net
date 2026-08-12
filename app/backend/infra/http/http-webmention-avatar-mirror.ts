import { fetchCapped } from "./fetch-capped";
import { isAllowedImageType, mediaTypeOf } from "./image-content-type";
import type { ILogger } from "~/backend/domain/shared";
import type {
  IWebmentionAvatarCache,
  IWebmentionAvatarMirror,
  WebmentionUrl,
} from "~/backend/domain/webmention";
import { errorToContext } from "~/backend/domain/shared";
import { webmentionAvatarIdFor } from "~/backend/domain/webmention";

/** 顔ひとつぶん。これを超えるものは肖像ではなく別の何かなので諦める。 */
const MAX_BYTES = 512 * 1024;

/**
 * 著者アイコンを取ってきて R2 に写す {@link IWebmentionAvatarMirror} 実装。
 *
 * **写せなくても throw しない。** 相手のアイコンが落ちている・大きすぎる・SVG である、
 * といったことはどれも想定内で、こちらでは直せない。記録を残して undefined を返し、
 * 顔の無い mention として通す (ADR 0014 と同じ線引き)。
 */
export class HttpWebmentionAvatarMirror implements IWebmentionAvatarMirror {
  constructor(
    private readonly cache: IWebmentionAvatarCache,
    private readonly logger: ILogger,
  ) {}

  async mirror(photo: WebmentionUrl): Promise<string | undefined> {
    try {
      const response = await fetchCapped(photo.toString(), {
        accept: "image/*",
        maxBytes: MAX_BYTES,
      });
      if (response === undefined) return undefined;
      if (!isAllowedImageType(response.contentType)) return undefined;

      const id = await webmentionAvatarIdFor(photo);
      await this.cache.put(id, {
        bytes: response.bytes,
        contentType: mediaTypeOf(response.contentType),
      });
      return id;
    } catch (error) {
      this.logger.debug("webmention avatar could not be mirrored", {
        photo: photo.toString(),
        ...errorToContext(error),
      });
      return undefined;
    }
  }
}
