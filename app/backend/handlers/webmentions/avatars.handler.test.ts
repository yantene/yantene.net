import { describe, expect, it } from "vitest";
import { createWebmentionAvatarsRouter } from "./avatars.handler";
import { R2WebmentionAvatarCache } from "~/backend/infra/r2/r2-webmention-avatar-cache";
import { createTestR2 } from "~/backend/infra/r2/test-helper";

/** ルーティングが縛っている形 (16 進 32 桁)。実際は URL の SHA-256 の先頭。 */
const id = "ab".repeat(16);

function envWith(bucket: R2Bucket): Env {
  return { R2: bucket } as unknown as Env;
}

async function seed(bucket: R2Bucket, bytes: Uint8Array): Promise<void> {
  await new R2WebmentionAvatarCache(bucket).put(id, {
    bytes,
    contentType: "image/png",
  });
}

describe("createWebmentionAvatarsRouter GET /avatars/:id", () => {
  it("写してある顔を Content-Type 付きで返す", async () => {
    const { bucket } = createTestR2();
    const bytes = new Uint8Array([1, 2, 3]);
    await seed(bucket, bytes);

    const res = await createWebmentionAvatarsRouter().request(
      `/avatars/${id}`,
      {},
      envWith(bucket),
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(bytes);
  });

  it("写しが無ければ 404", async () => {
    const { bucket } = createTestR2();

    const res = await createWebmentionAvatarsRouter().request(
      `/avatars/${id}`,
      {},
      envWith(bucket),
    );

    expect(res.status).toBe(404);
  });

  /*
   * 0 バイトの写しが入ってしまったものがある (#322)。空を 200 で配ると経路上の蓄えに
   * 空が乗るので、在ることにしない。**読み手の画面はこれでは直らない** (404 でも
   * <img> は描けない)。代わりを出すのは webmention-list.tsx の仕事。
   */
  it("写しが 0 バイトなら在ることにしない", async () => {
    const { bucket } = createTestR2();
    await seed(bucket, new Uint8Array(0));

    const res = await createWebmentionAvatarsRouter().request(
      `/avatars/${id}`,
      {},
      envWith(bucket),
    );

    expect(res.status).toBe(404);
  });

  it("id の形が違えば取り合わない", async () => {
    const { bucket } = createTestR2();

    const res = await createWebmentionAvatarsRouter().request(
      "/avatars/../../secret",
      {},
      envWith(bucket),
    );

    expect(res.status).toBe(404);
  });
});
