/** ベクトルとして受け取れない値が来た。 */
export class InvalidEmbeddingVectorError extends Error {
  readonly name = "InvalidEmbeddingVectorError";
}

/** ベクトルを作りに行って作れなかった。外部のモデルに触るので、通信の失敗もここに入る。 */
export class EmbeddingGenerationError extends Error {
  readonly name = "EmbeddingGenerationError";
}
