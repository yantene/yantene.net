import { describe, expect, it } from "vitest";
import { headers } from "./sign-in.confirm";

/*
 * **loader が `data(..., { headers })` で付けただけでは文書の応答に載らない。**
 * React Router はルートが `headers` を出しているときにだけ引き継ぐ。手元で確かめて
 * 気づいた抜けなので、消されないよう固定する。
 */
describe("確認の画面のヘッダー", () => {
  it("人によって変わる応答を経路に置かせない", () => {
    const value = headers({} as Parameters<typeof headers>[0]);

    expect(value).toMatchObject({
      "Cache-Control": "private, no-store",
      Vary: "Cookie",
    });
  });
});
