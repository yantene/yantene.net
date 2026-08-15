import { describe, expect, it } from "vitest";
import { createOgRouter } from "./og.handler";
import { createTestD1 } from "~/backend/infra/d1/test-helper";
import cityscapeSource from "~/frontend/assets/cityscape.svg?raw";

/** カードを描くところまでは行かないので、D1 だけあればよい。 */
function envWith(d1: D1Database): Env {
  return { D1: d1 } as unknown as Env;
}

/**
 * OG カードは街並みの素材をそのままは使えない。輪郭が `currentColor` で、線の太さを
 * 持たず、雲が混じっているためで、`og.handler.ts` はこれらを素材の書き方に頼って解いて
 * いる。頼っている書き方が変わっていないことをここで見張る。
 *
 * 素材は scripts/extract-illustration.py が作業用の illustration.svg から書き出し、
 * 書き出したものを手で整えて置いてある (整え方は素材の先頭に書いてある)。だからここが
 * 落ちたときに直す先は、素材そのものでも `og.handler.ts` でもなく、たいていは書き出しと
 * 手入れの工程。たとえば `clean()` が吐くのは `style="…stroke:currentColor…"` で、
 * ここが見ている `stroke="currentColor"` の形は手入れを経て初めて現れる。
 */
describe("cityscape.svg (OG カードが頼っている書き方)", () => {
  it("雲と街を id で分けている", () => {
    // 雲は流れることで雲に見える意匠なので、止まった絵の OG では落とす。
    expect(cityscapeSource).toContain('<g id="clouds">');
    expect(cityscapeSource).toContain('<g id="skyline">');
  });

  it("雲を先に、街を後に置いている", () => {
    // og.handler.ts は「雲の頭から街の頭まで」を切って雲を落とす。
    expect(cityscapeSource.indexOf('<g id="clouds">')).toBeLessThan(
      cityscapeSource.indexOf('<g id="skyline">'),
    );
  });

  it("輪郭の色を currentColor で受けている", () => {
    // img の data URI には文書の color が届かないので、焼き込む先の目印になる。
    expect(cityscapeSource).toContain('stroke="currentColor"');
  });

  it("線の太さを持たない", () => {
    // 太さは画面では CSS が、OG では og.handler.ts が与える。素材が持ち始めたら
    // 与えた値が効かなくなる (要素側の指定が勝つ)。
    expect(cityscapeSource).not.toContain("stroke-width");
  });

  it("根元のタグが属性を伴って開いている", () => {
    // og.handler.ts は `"<svg "` を目印に線の太さを差し込む。文字列指定の replace は
    // 見つからなければ黙って何もしないので、`<svg>` や `<svg\n` に変わると線が
    // 既定の太さ (この縮尺で約 3px) のまま出る。
    expect(cityscapeSource).toContain("<svg ");
  });

  it("viewBox の縦横比が変わっていない", () => {
    // og.handler.ts の CITYSCAPE_HEIGHT (1200px 幅に対する 175px) はこの比から出した
    // 値で、img には preserveAspectRatio を渡していない。比が動くと街が縦に潰れる。
    expect(cityscapeSource).toContain('viewBox="0 0 407.1932 59.2666"');
  });
});

/** 応答を、断り方として見比べられる形に均す。 */
async function refusalOf(
  response: Response,
): Promise<{ status: number; contentType: string; body: unknown }> {
  return {
    status: response.status,
    contentType: response.headers.get("Content-Type") ?? "",
    body: await response.json(),
  };
}

/** RFC 9457 が必須にしている項目。断り方が変わったらここで気づく。 */
const problemDetails404 = {
  status: 404,
  contentType: "application/problem+json",
  body: {
    type: "about:blank",
    title: "Not Found",
    status: 404,
    detail: "note not found",
  },
};

/*
 * 見つからなかったときの形。
 *
 * 返すものが画像であっても、返せなかったときの形はサイト全体で 1 つに揃える
 * (RFC 9457 Problem Details)。ここだけ Hono 既定の素の 404 に戻っていたのが #277。
 * 同じく画像を配る link-cards/assets.handler.ts が Problem Details で断っているので、
 * 「画像だから API ではない」は理由にならない。
 */
describe("createOgRouter GET /notes/:slug が見つからないとき", () => {
  /*
   * D1 を渡さない。読めないスラグは表を引く手前で返るので、これで通ることが
   * 「引く前に断っている」ことの裏取りにもなる。
   */
  it("スラグとして読めない値を、表を引かずに Problem Details で断る", async () => {
    const response = await createOgRouter().request(
      `/notes/${encodeURIComponent("not a slug!")}`,
      {},
      {},
    );

    await expect(refusalOf(response)).resolves.toEqual(problemDetails404);
  });

  it("記事が無いときも Problem Details で断る", async () => {
    // 表は作ってあるが 1 件も入っていない。
    const response = await createOgRouter().request(
      "/notes/missing",
      {},
      envWith(createTestD1()),
    );

    await expect(refusalOf(response)).resolves.toEqual(problemDetails404);
  });

  /*
   * 404 に倒す try で囲ってあるのはスラグの解釈だけで、表を引くところは外に在る。
   * 引くところまで囲うと、D1 の不調が「カードの無い記事」の顔をして静かに通る。
   *
   * いまの NoteSlug.create は InvalidNoteSlugError しか投げないので、握りの狭さ自体は
   * 入力からは確かめようがない。代わりに、握りの外に在るべきものが外に在ることを見る。
   */
  it("表を引けなかった失敗は握らずに投げる", async () => {
    const broken = {
      D1: {
        prepare: () => {
          throw new Error("D1 is down");
        },
      },
    } as unknown as Env;

    const response = await createOgRouter().request(
      "/notes/missing",
      {},
      broken,
    );

    // 404 にならないことが眼目。本番では index.ts の onError がこれを拾う。
    expect(response.status).not.toBe(404);
    expect(response.status).toBeGreaterThanOrEqual(500);
  });
});
