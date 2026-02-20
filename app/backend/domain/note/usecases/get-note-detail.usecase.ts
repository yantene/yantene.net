import { MarkdownNotFoundError, NoteNotFoundError } from "../errors";
import { markdownToMdast } from "../markdown-to-mdast";
import type { IMarkdownStorage } from "../markdown-storage.interface";
import type { NoteSlug } from "../note-slug.vo";
import type { INoteQueryRepository } from "../note.query-repository.interface";
import type { NoteDetailResponse } from "~/lib/types/notes";

export class GetNoteDetailUseCase {
  constructor(
    private readonly queryRepository: INoteQueryRepository,
    private readonly markdownStorage: IMarkdownStorage,
  ) {}

  async execute(slug: NoteSlug): Promise<NoteDetailResponse> {
    const note = await this.queryRepository.findBySlug(slug);
    if (!note) {
      throw new NoteNotFoundError(slug.value);
    }

    const markdownContent = await this.markdownStorage.get(slug);
    if (!markdownContent) {
      throw new MarkdownNotFoundError(slug.value);
    }

    const text = await new Response(markdownContent.body).text();
    const content = markdownToMdast(text, slug);

    return {
      id: note.id,
      title: note.title.toJSON(),
      slug: note.slug.toJSON(),
      imageUrl: note.imageUrl.toJSON(),
      publishedOn: note.publishedOn.toString(),
      lastModifiedOn: note.lastModifiedOn.toString(),
      content,
    };
  }
}
