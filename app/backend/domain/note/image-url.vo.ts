import type { IValueObject } from "~/backend/domain/shared";

// ノートのカバー画像 URL。フロントマターの相対パス (`./cover.png`) は
// アセット API URL (ルート相対 `/api/v1/notes/<slug>/assets/...`) に解決してから
// VO 化する前提で、ここでは解決済みの「ルート相対パス」だけを受け入れる。
//
// 絶対 URL は弾く。これは 2 つの規約を同時に満たすため:
//   - Artifacts の直接 URL を露出させない (product 規約)。絶対 URL を許すと
//     未解決の生 Artifacts URL がそのまま通り得る。
//   - 画像はアセット API (self) 経由で配信する。CSP の img-src は 'self' data:
//     のみで外部ホストの画像は表示できないため、絶対 URL を持たせても無意味。
const MAX_LENGTH = 2048;

export class InvalidImageUrlError extends Error {
  readonly name = "InvalidImageUrlError";
}

export class ImageUrl implements IValueObject<ImageUrl> {
  private constructor(private readonly value: string) {}

  static create(raw: string): ImageUrl {
    const trimmed = raw.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_LENGTH) {
      throw new InvalidImageUrlError(
        `Image URL must be 1..${String(MAX_LENGTH)} characters long`,
      );
    }
    // ルート相対パスのみ。"//" 始まり (プロトコル相対 = 絶対 URL 相当) は弾く。
    if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
      throw new InvalidImageUrlError(
        "Image URL must be a root-relative asset path (e.g. /api/v1/notes/<slug>/assets/<file>)",
      );
    }
    return new ImageUrl(trimmed);
  }

  toString(): string {
    return this.value;
  }

  equals(other: ImageUrl): boolean {
    return this.value === other.value;
  }

  toJSON(): string {
    return this.value;
  }
}
