import { Temporal } from "@js-temporal/polyfill";
import { describe, expect, it } from "vitest";
import { NoteMetadataValidationError, NoteParseError } from "./errors";
import { ImageUrl } from "./image-url.vo";
import { parseNoteContent } from "./note-content.parser";
import { NoteSlug } from "./note-slug.vo";
import { NoteTitle } from "./note-title.vo";

describe("parseNoteContent", () => {
  const slug = NoteSlug.create("my-article");

  it("正常な frontmatter からメタデータを抽出する", () => {
    const content = `---
title: "テスト記事"
imageUrl: "https://example.com/image.png"
publishedOn: "2025-01-15"
lastModifiedOn: "2025-02-01"
---

# 本文
`;

    const metadata = parseNoteContent(content, slug);

    expect(metadata.title.equals(NoteTitle.create("テスト記事"))).toBe(true);
    expect(
      metadata.imageUrl.equals(
        ImageUrl.create("https://example.com/image.png"),
      ),
    ).toBe(true);
    expect(
      metadata.publishedOn.equals(Temporal.PlainDate.from("2025-01-15")),
    ).toBe(true);
    expect(
      metadata.lastModifiedOn.equals(Temporal.PlainDate.from("2025-02-01")),
    ).toBe(true);
  });

  it("相対パスの imageUrl をアセット API URL に解決する", () => {
    const content = `---
title: "テスト記事"
imageUrl: "./cover.png"
publishedOn: "2025-01-15"
lastModifiedOn: "2025-02-01"
---

# 本文
`;

    const metadata = parseNoteContent(content, slug);

    expect(
      metadata.imageUrl.equals(
        ImageUrl.create("/api/v1/notes/my-article/assets/cover.png"),
      ),
    ).toBe(true);
  });

  it("'./' なしの相対パスの imageUrl もアセット API URL に解決する", () => {
    const content = `---
title: "テスト記事"
imageUrl: "images/hero.jpg"
publishedOn: "2025-01-15"
lastModifiedOn: "2025-02-01"
---

# 本文
`;

    const metadata = parseNoteContent(content, slug);

    expect(
      metadata.imageUrl.equals(
        ImageUrl.create("/api/v1/notes/my-article/assets/images/hero.jpg"),
      ),
    ).toBe(true);
  });

  it("絶対 URL の imageUrl はそのまま保持する", () => {
    const content = `---
title: "テスト記事"
imageUrl: "https://example.com/image.png"
publishedOn: "2025-01-15"
lastModifiedOn: "2025-02-01"
---

# 本文
`;

    const metadata = parseNoteContent(content, slug);

    expect(
      metadata.imageUrl.equals(
        ImageUrl.create("https://example.com/image.png"),
      ),
    ).toBe(true);
  });

  it("必須フィールドが欠落している場合に NoteMetadataValidationError をスローする", () => {
    const content = `---
title: "タイトルのみ"
---

# 本文
`;

    expect(() => parseNoteContent(content, slug)).toThrow(
      NoteMetadataValidationError,
    );

    try {
      parseNoteContent(content, slug);
    } catch (error) {
      const validationError = error as NoteMetadataValidationError;
      expect(validationError.fileName).toBe("my-article.md");
      expect(validationError.missingFields).toContain("imageUrl");
      expect(validationError.missingFields).toContain("publishedOn");
      expect(validationError.missingFields).toContain("lastModifiedOn");
    }
  });

  it("frontmatter がない場合に NoteParseError をスローする", () => {
    const content = `# ただの Markdown

本文のみ
`;

    expect(() => parseNoteContent(content, slug)).toThrow(NoteParseError);
  });

  it("不正な YAML の場合に NoteParseError をスローする", () => {
    const content = `---
title: [invalid yaml
  broken: {
---

# 本文
`;

    expect(() => parseNoteContent(content, slug)).toThrow(NoteParseError);
  });

  it("全フィールドが欠落している場合に全フィールド名を含むバリデーションエラーをスローする", () => {
    const content = `---
unknownField: "value"
---

# 本文
`;

    try {
      parseNoteContent(content, slug);
    } catch (error) {
      const validationError = error as NoteMetadataValidationError;
      expect(validationError.missingFields).toEqual([
        "title",
        "imageUrl",
        "publishedOn",
        "lastModifiedOn",
      ]);
    }
  });
});
