export class ArticleNotFoundError extends Error {
  readonly name = "ArticleNotFoundError";
  constructor(slug: string) {
    super(`Article not found: ${slug}`);
  }
}
