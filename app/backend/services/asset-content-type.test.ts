import { describe, expect, it } from "vitest";
import { contentTypeForPath } from "./asset-content-type";

describe("contentTypeForPath", () => {
  it("maps known image extensions (case-insensitively)", () => {
    expect(contentTypeForPath("cover.png")).toBe("image/png");
    expect(contentTypeForPath("a/b.JPG")).toBe("image/jpeg");
    expect(contentTypeForPath("icon.svg")).toBe("image/svg+xml");
    expect(contentTypeForPath("photo.webp")).toBe("image/webp");
  });

  it("maps audio extensions (case-insensitively)", () => {
    expect(contentTypeForPath("song.opus")).toBe("audio/ogg");
    expect(contentTypeForPath("song.mp3")).toBe("audio/mpeg");
    expect(contentTypeForPath("song.mid")).toBe("audio/midi");
    expect(contentTypeForPath("song.MIDI")).toBe("audio/midi");
  });

  it("falls back to octet-stream for unknown or missing extensions", () => {
    expect(contentTypeForPath("file.bin")).toBe("application/octet-stream");
    expect(contentTypeForPath("noext")).toBe("application/octet-stream");
  });
});
