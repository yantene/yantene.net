import { hasLinkToTarget, readMention } from "./webmention-source-reader";
import type { NoteId } from "~/backend/domain/note";
import type { ILogger } from "~/backend/domain/shared";
import type {
  IWebmentionAvatarMirror,
  IWebmentionCommandRepository,
  IWebmentionSourceFetcher,
  WebmentionRequest,
} from "~/backend/domain/webmention";
import { Webmention } from "~/backend/domain/webmention";

/**
 * 受け取った Webmention を、送り元を実際に読んで確かめてから保存する。
 *
 * 送り手を待たせている間 (同期段) にできるのは形式の検証までで、ここから先は相手の
 * サーバー次第で時間がかかる。呼び出し側は `waitUntil` に渡して切り離すこと。
 *
 * 保存されるのは「いま source が target をリンクしている」ものだけ。リンクが消えて
 * いたり記事ごと消えていたりしたら、保存済みの行を落とす (Webmention は再送で更新
 * される仕様なので、書きっぱなしにすると古い返信が残り続ける)。
 */
export class WebmentionVerificationService {
  constructor(
    private readonly fetcher: IWebmentionSourceFetcher,
    private readonly commands: IWebmentionCommandRepository,
    private readonly avatars: IWebmentionAvatarMirror,
    private readonly logger: ILogger,
  ) {}

  async verify(noteId: NoteId, request: WebmentionRequest): Promise<void> {
    const log = this.logger.child({
      source: request.source.toString(),
      target: request.target.toString(),
    });

    const result = await this.fetcher.fetch(request.source);

    /*
     * 取れなかった。相手が落ちているのは異常ではないので、ログを残すだけで何もしない
     * (このサイトの既定は fail-loud だが、外部サイトの可用性はこちらでは直せない)。
     * 消さないのは、一時的な障害で過去に受け取った返信まで消えないようにするため。
     */
    if (result.kind === "unavailable") {
      log.info("webmention skipped", { reason: result.reason });
      return;
    }

    if (result.kind === "gone") {
      await this.commands.deleteBySource(noteId, request.source);
      log.info("webmention removed: source is gone");
      return;
    }

    /*
     * 転送の追い先が別のホストなら、読んだ文書は source の文書ではない。名乗りと中身が
     * 食い違ったまま保存すると、次の二つを許してしまう。
     *
     * - **自分のページを読んで自分で頷く**: 記事ページは自分自身への canonical リンクを
     *   出しているので、こちらへ転送するだけでリンクの検証を通ってしまう。第三者サイトの
     *   オープンリダイレクタを 1 つ見つければ、その名前で好きな記事に行を作れる
     * - **他人の返信を横取りする**: 誰かの本物の返信ページへ転送すれば、その人の名前と
     *   本文を、こちらの選んだ source の行として保存させられる
     *
     * スキームだけの転送 (http → https) は素通しさせたいので、origin ではなくホスト名で
     * 見る。別ホストへの転送 (短縮 URL や www の付け外し) は通らなくなるが、送り手は
     * 記事そのものの URL を投げればよい。
     */
    if (result.url.hostname !== request.source.hostname) {
      log.info("webmention skipped: redirected to another host", {
        resolved: result.url.toString(),
      });
      return;
    }

    if (!hasLinkToTarget(result.html, result.url, request.target)) {
      // リンクが消えた = 取り消し。初回なら消す行が無いだけで、結果は同じ。
      await this.commands.deleteBySource(noteId, request.source);
      log.info("webmention removed: source does not link to target");
      return;
    }

    const parsed = readMention(result.html, result.url, request.target);

    /*
     * 著者アイコンを自分のところへ写す。相手のドメインからは読み込めない
     * (`img-src 'self' data:`)。写せなくても mention は保存する — 顔が無いだけで、
     * 誰が何を言ったかは残る。
     */
    const photo = parsed.author.photo;
    const authorAvatar =
      photo === undefined ? undefined : await this.avatars.mirror(photo);

    await this.commands.upsert(
      Webmention.create({
        noteId,
        target: request.targetSlug,
        source: request.source,
        type: parsed.type,
        author: parsed.author,
        authorAvatar,
        content: parsed.content,
        publishedAt: parsed.publishedAt,
      }),
    );
    log.info("webmention stored", { type: parsed.type.toString() });
  }
}
