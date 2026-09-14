/**
 * 作品の在り処を、読み手に見せる形に短くする。
 *
 * `https://github.com/yantene/infoholick` → `github.com/yantene/infoholick`。
 * スキームは全部 https で揃うので出しても情報にならず、その分だけ行き先の字が
 * 押し出される。末尾の `/` も落とす (`example.com/` は `example.com` と同じ場所)。
 *
 * **読めない URL はそのまま返す。** ここに来るのは VO を通った値だけなので起こらない
 * はずだが、握って空文字にすると「在り処があるのに何も出ない」項目ができる。
 */
export function displayUrl(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  const path = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  return `${parsed.host}${path === "/" ? "" : path}`;
}
