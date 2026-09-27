const contentTypes = new Map<string, string>([
  ["png", "image/png"],
  ["jpg", "image/jpeg"],
  ["jpeg", "image/jpeg"],
  ["gif", "image/gif"],
  ["webp", "image/webp"],
  ["avif", "image/avif"],
  ["svg", "image/svg+xml"],
  /*
   * 音声。本文の `<audio>` が読む再生用と、読者が持ち帰る配布用に分かれる。
   *
   * 再生用は Opus だけを置く。ロイヤリティフリーで、20 秒程度の曲なら数 KB に収まる。
   * コンテナは Ogg (`.opus`)。`.webm` にしないのは、拡張子から音声か動画かを決められず、
   * この表が Content-Type を一意に返せなくなるため。
   *
   * `.mid` はブラウザが再生できない (音源を積んでいない)。それでも型を与えるのは、
   * octet-stream で配るより中身を正しく名乗るほうが良く、リンクを開いた読者には
   * どのみちダウンロードになるため。
   */
  ["opus", "audio/ogg"],
  ["mp3", "audio/mpeg"],
  ["mid", "audio/midi"],
  ["midi", "audio/midi"],
  /*
   * 動画。本文の `<video>` が読む再生用で、置くのは WebM だけにする。
   *
   * 中身は VP9 1 本で、ロイヤリティフリーである (ADR 0046)。AV1 を足さないのは、
   * AV1 が届く先はすべて VP9 も再生でき、逆は成り立たないためである (Safari は WebM の
   * AV1 を再生できない)。焼くのを 1 回で済ませる代わりに 700 KB ほど損している。
   * **H.264 は置かない。** 特許プールのあるコーデックで、Opus を選んだときの観点と
   * 噛み合わない。どちらのコーデックかは `<source>` の `type` に書く codecs で
   * ブラウザが選り分ける。
   *
   * ADR 0022 が `.webm` を避けたのは、拡張子から音声か動画かを決められず、この表が
   * Content-Type を一意に返せなくなるためだった。**ここでは「`.webm` は動画」と
   * 決めることで、その曖昧さを解く。** 音声は Ogg (`.opus`) に置くと同じ ADR が
   * 決めているので、WebM に音声だけを入れることはない。
   */
  ["webm", "video/webm"],
]);

const DEFAULT_CONTENT_TYPE = "application/octet-stream";

/** ファイルパスの拡張子から Content-Type を推定する。 */
export function contentTypeForPath(path: string): string {
  const dot = path.lastIndexOf(".");
  if (dot === -1) return DEFAULT_CONTENT_TYPE;
  const ext = path.slice(dot + 1).toLowerCase();
  return contentTypes.get(ext) ?? DEFAULT_CONTENT_TYPE;
}
