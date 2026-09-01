import { buildEmbeddingChunks } from "./note-embedding-text";
import type { Root } from "mdast";
import type { INoteContentCache, INoteQueryRepository } from "~/backend/domain/note";
import type {
  IEmbeddingGenerator,
  INoteEmbeddingCommandRepository,
  INoteEmbeddingQueryRepository,
  NoteEmbedding,
  NoteSimilarity,
} from "~/backend/domain/note-embedding";
import type { ILogger } from "~/backend/domain/shared";
import { NoteSlug } from "~/backend/domain/note";
import { EmbeddingGenerationError, EmbeddingVector } from "~/backend/domain/note-embedding";
import { errorToContext } from "~/backend/domain/shared";

/**
 * 1 回の refresh で作り直すベクトルの上限。
 *
 * 1 本につきモデルの呼び出しが最低 1 回出るので、Workers のサブリクエスト上限に対して
 * 余裕を持たせる。溢れた分は次回に回る。
 */
const MAX_NOTES_PER_RUN = 30;

export interface NoteEmbeddingsSyncResult {
  /** ベクトルを作り直した slug。 */
  readonly embedded: string[];
  /** 本文もモデルも変わっていないので作り直さなかった slug。 */
  readonly unchanged: string[];
  /** 作れなかった slug。関連ノートは前回の並びのまま残る。 */
  readonly failed: string[];
  /** 上限に掛かって今回は見送った件数。黙って切り捨てない。 */
  readonly deferred: number;
}

/**
 * 記事のベクトルと、記事どうしの近さを揃えるサービス。
 *
 * ノートの同期 (NotesRefreshService) から分けてあるのは、外部のモデルに触るので失敗の
 * 扱いが違うため。リンクカードと同じ理由で、こちらが落ちても記事の同期は通す。
 * ベクトルが作れなかった記事は、前回のベクトルと近さがそのまま残る。
 *
 * 近さは上位 N 件に切らずにペアのまま保存する。切ってしまうと、後から書いた記事が
 * 古い記事の関連ノートに永久に出てこない (refresh は変更のあった記事しか処理しない)。
 */
export class NoteEmbeddingsRefreshService {
  constructor(
    private readonly generator: IEmbeddingGenerator,
    private readonly command: INoteEmbeddingCommandRepository,
    private readonly query: INoteEmbeddingQueryRepository,
    private readonly notes: INoteQueryRepository,
    private readonly cache: INoteContentCache,
    private readonly logger: ILogger,
  ) {}

  async sync(
    slugs: readonly string[],
    options: { readonly force?: boolean } = {},
  ): Promise<NoteEmbeddingsSyncResult> {
    const stored = await this.query.listAll();
    const bySlug = new Map(stored.map((item) => [item.slug.toString(), item] as const));
    const hashes = await this.notes.listSourceHashes();

    const embedded: string[] = [];
    const unchanged: string[] = [];
    const failed: string[] = [];

    // 作り直すものを先に決める。モデルを差し替えたときは全部が対象になる。
    const targets = slugs.filter((slug) => {
      const current = bySlug.get(slug);
      if (options.force === true || current === undefined) return true;
      const isSameModel = current.model === this.generator.model;
      const isSameContent = current.contentHash === (hashes.get(slug) ?? "");
      if (isSameModel && isSameContent) {
        unchanged.push(slug);
        return false;
      }
      return true;
    });

    const planned = targets.slice(0, MAX_NOTES_PER_RUN);
    // 途中で作ったベクトルも近さの計算に入れる。同じ回に処理した記事どうしが
    // 互いの関連ノートに出ないと、新しく足した記事がひとかたまりで抜け落ちる。
    const known = new Map(bySlug);

    for (const slug of planned) {
      const result = await this.embedNote(slug, hashes.get(slug) ?? "");
      if (result === undefined) {
        failed.push(slug);
        continue;
      }
      await this.command.upsert(result);
      known.set(slug, result);
      await this.command.replaceSimilarities(result.noteId, similaritiesFor(result, known));
      embedded.push(slug);
    }

    return { embedded, unchanged, failed, deferred: targets.length - planned.length };
  }

  /** 1 本ぶんのベクトルを作る。作れなければ undefined を返して呼び出し側に判断を渡す。 */
  private async embedNote(slug: string, contentHash: string): Promise<NoteEmbedding | undefined> {
    try {
      const note = await this.notes.findBySlug(NoteSlug.create(slug));
      if (note?.id === undefined) return undefined;
      const mdast = (await this.cache.getMdast(note.slug)) as Root | undefined;
      if (mdast === undefined) {
        throw new EmbeddingGenerationError(`No cached MDAST for ${slug}.`);
      }
      const chunks = buildEmbeddingChunks(
        note.title.toString(),
        mdast,
        this.generator.maxInputCharacters,
      );
      const vectors = await this.generator.embed(chunks);
      return {
        noteId: note.id,
        slug: note.slug,
        model: this.generator.model,
        contentHash,
        // 分けて投げた分は平均して 1 本にする。mean が正規化まで済ませる。
        vector: vectors.length === 1 ? vectors[0] : EmbeddingVector.mean(vectors),
      };
    } catch (error) {
      // 記事の同期は既に済んでいる。ここで throw すると refresh 全体が落ちるので、
      // 1 本ぶんの失敗として記録して次へ進む。前回のベクトルはそのまま残る。
      this.logger.warn("failed to embed note", { slug, ...errorToContext(error) });
      return undefined;
    }
  }
}

/** この記事と、既に分かっている全記事との近さ。自分自身は含めない。 */
function similaritiesFor(
  target: NoteEmbedding,
  known: ReadonlyMap<string, NoteEmbedding>,
): readonly NoteSimilarity[] {
  return [...known.values()]
    .filter((other) => other.noteId !== target.noteId)
    .filter((other) => other.vector.dimensions === target.vector.dimensions)
    .map((other) => ({
      noteId: target.noteId,
      otherNoteId: other.noteId,
      similarity: target.vector.similarityTo(other.vector),
    }));
}
