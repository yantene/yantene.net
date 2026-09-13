import type { LinkCardMap } from "./link-card-view";
import type { Root } from "mdast";
import { toLinkCardMap } from "./link-card-view";
import { LinkCardUrl } from "~/backend/domain/link-card";
import { D1LinkCardQueryRepository } from "~/backend/infra/d1/repositories";
import { collectBareLinkUrls } from "~/lib/link-card/bare-link";

/**
 * 本文に貼られたむき出しの URL のカードを引く。
 *
 * カードが無い URL は表に載らず、描画側は素のリンクのまま描く。ここで取りに行くことは
 * しない。通常のリクエストで外部を叩かないため (ADR 0004)、取得は refresh の仕事。
 *
 * 記事の本文でも `/about` の長い自己紹介でも同じことをするので、ここに置いてある。
 */
export async function loadLinkCards(env: Env, mdast: Root): Promise<LinkCardMap> {
  const urls = collectBareLinkUrls(mdast);
  if (urls.length === 0) return {};

  const cards = await new D1LinkCardQueryRepository(env.D1).findByUrls(
    urls.map((url) => LinkCardUrl.create(url)),
  );
  return toLinkCardMap(cards);
}
