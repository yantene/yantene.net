import { customType, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { notes } from "./notes";

/**
 * BLOB を Uint8Array のまま扱う列。
 *
 * drizzle の `blob({ mode: "buffer" })` は Node の Buffer を要求する。Workers でも
 * nodejs_compat があれば動くが、ベクトルを出し入れするだけのために polyfill を
 * 通す理由がない。D1 が返すのは ArrayBuffer なので、そのまま写して返す。
 */
const vectorBytes = customType<{ data: Uint8Array; driverData: ArrayBuffer }>({
  dataType: () => "blob",
  toDriver: (value) =>
    value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) as ArrayBuffer,
  fromDriver: (value) => new Uint8Array(value),
});

/**
 * 記事 1 本ぶんのベクトル。
 *
 * ベクトルそのものを D1 に置くのは、これが「索引のための派生データ」であって本文では
 * ないため (ADR 0004 の分担では D1 がメタデータの索引、R2 が本文と画像のキャッシュ)。
 * 1024 次元の float32 で 1 本 4 KB、57 本で 0.22 MB。D1 の 1 行あたりの BLOB 上限
 * (2 MB) にも遠い。
 *
 * - model: 作ったモデルの識別子。差し替えたら作り直す
 * - content_hash: 作った時点の notes.source_hash。本文が変わったら作り直す
 * - dimensions: vector の長さ。次元の違う行が混ざったことを読むときに気づける
 */
export const noteEmbeddings = sqliteTable("note_embeddings", {
  noteId: text("note_id")
    .primaryKey()
    .references(() => notes.id, { onDelete: "cascade" }),
  model: text("model").notNull(),
  contentHash: text("content_hash").notNull(),
  dimensions: integer("dimensions").notNull(),
  // L2 正規化済みの float32 の並び。正規化してあるのでコサイン類似度は内積で済む。
  vector: vectorBytes("vector").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
