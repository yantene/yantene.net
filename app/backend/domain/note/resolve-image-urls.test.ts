import { describe, expect, it } from "vitest";
import { NoteSlug } from "./note-slug.vo";
import { resolveImageUrls } from "./resolve-image-urls";
import type { Root } from "mdast";

const slug = NoteSlug.create("my-article");

describe("resolveImageUrls", () => {
  it("相対パスの画像 URL をアセット配信 API の URL に変換する", () => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            {
              type: "image",
              url: "images/diagram.png",
              alt: "Diagram",
            },
          ],
        },
      ],
    };

    const result = resolveImageUrls(tree, slug);

    const paragraph = result.children[0];
    if (paragraph.type !== "paragraph") throw new Error("unexpected");
    const image = paragraph.children[0];
    if (image.type !== "image") throw new Error("unexpected");

    expect(image.url).toBe(
      "/api/v1/notes/my-article/assets/images/diagram.png",
    );
  });

  it("絶対 URL (https://) はそのまま保持する", () => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            {
              type: "image",
              url: "https://example.com/photo.jpg",
              alt: "Photo",
            },
          ],
        },
      ],
    };

    const result = resolveImageUrls(tree, slug);

    const paragraph = result.children[0];
    if (paragraph.type !== "paragraph") throw new Error("unexpected");
    const image = paragraph.children[0];
    if (image.type !== "image") throw new Error("unexpected");

    expect(image.url).toBe("https://example.com/photo.jpg");
  });

  it("絶対 URL (http://) はそのまま保持する", () => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            {
              type: "image",
              url: "http://example.com/photo.jpg",
              alt: "Photo",
            },
          ],
        },
      ],
    };

    const result = resolveImageUrls(tree, slug);

    const paragraph = result.children[0];
    if (paragraph.type !== "paragraph") throw new Error("unexpected");
    const image = paragraph.children[0];
    if (image.type !== "image") throw new Error("unexpected");

    expect(image.url).toBe("http://example.com/photo.jpg");
  });

  it("image ノードがない場合はツリーをそのまま返す", () => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            {
              type: "text",
              value: "Hello world",
            },
          ],
        },
      ],
    };

    const result = resolveImageUrls(tree, slug);

    expect(result).toEqual(tree);
  });

  it("ネストされた image ノードも走査して変換する", () => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "blockquote",
          children: [
            {
              type: "paragraph",
              children: [
                {
                  type: "image",
                  url: "nested/image.png",
                  alt: "Nested",
                },
              ],
            },
          ],
        },
      ],
    };

    const result = resolveImageUrls(tree, slug);

    const blockquote = result.children[0];
    if (blockquote.type !== "blockquote") throw new Error("unexpected");
    const paragraph = blockquote.children[0];
    if (paragraph.type !== "paragraph") throw new Error("unexpected");
    const image = paragraph.children[0];
    if (image.type !== "image") throw new Error("unexpected");

    expect(image.url).toBe("/api/v1/notes/my-article/assets/nested/image.png");
  });

  it("元のツリーを変更せず、新しいツリーを返す", () => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            {
              type: "image",
              url: "photo.png",
              alt: "Photo",
            },
          ],
        },
      ],
    };

    const result = resolveImageUrls(tree, slug);

    expect(result).not.toBe(tree);

    const originalParagraph = tree.children[0];
    if (originalParagraph.type !== "paragraph") throw new Error("unexpected");
    const originalImage = originalParagraph.children[0];
    if (originalImage.type !== "image") throw new Error("unexpected");
    expect(originalImage.url).toBe("photo.png");
  });

  it("'./' プレフィックス付きの相対パスを正規化して変換する", () => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            {
              type: "image",
              url: "./hero.png",
              alt: "Hero",
            },
          ],
        },
      ],
    };

    const result = resolveImageUrls(tree, slug);

    const paragraph = result.children[0];
    if (paragraph.type !== "paragraph") throw new Error("unexpected");
    const image = paragraph.children[0];
    if (image.type !== "image") throw new Error("unexpected");

    expect(image.url).toBe("/api/v1/notes/my-article/assets/hero.png");
  });

  it("複数の image ノードを含むツリーですべて変換する", () => {
    const tree: Root = {
      type: "root",
      children: [
        {
          type: "paragraph",
          children: [
            {
              type: "image",
              url: "first.png",
              alt: "First",
            },
          ],
        },
        {
          type: "paragraph",
          children: [
            {
              type: "image",
              url: "https://external.com/second.png",
              alt: "Second",
            },
          ],
        },
        {
          type: "paragraph",
          children: [
            {
              type: "image",
              url: "third.jpg",
              alt: "Third",
            },
          ],
        },
      ],
    };

    const result = resolveImageUrls(tree, slug);

    const getImageUrl = (index: number): string => {
      const paragraph = result.children[index];
      if (paragraph.type !== "paragraph") throw new Error("unexpected");
      const image = paragraph.children[0];
      if (image.type !== "image") throw new Error("unexpected");
      return image.url;
    };

    expect(getImageUrl(0)).toBe("/api/v1/notes/my-article/assets/first.png");
    expect(getImageUrl(1)).toBe("https://external.com/second.png");
    expect(getImageUrl(2)).toBe("/api/v1/notes/my-article/assets/third.jpg");
  });
});
