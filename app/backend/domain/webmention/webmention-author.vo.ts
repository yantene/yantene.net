import { toPlainText } from "./plain-text";
import { WebmentionUrl } from "./webmention-url.vo";
import type { IValueObject } from "~/backend/domain/shared";

/** 保存する著者名の長さの上限。名乗りに使う長さで、本文を押し込む場所ではない。 */
const MAX_NAME_LENGTH = 100;

interface AuthorFields {
  readonly name: string | undefined;
  readonly url: WebmentionUrl | undefined;
  readonly photo: WebmentionUrl | undefined;
}

/**
 * Webmention の送り手 (h-card から読み取る名前・ページ・アイコン)。
 *
 * 三つとも欠けうる。名乗らずに送ってくる相手を弾く理由はないので、揃っていることを
 * 前提にしない。名前は生成の時点で HTML を落としたテキストにする。
 */
export class WebmentionAuthor implements IValueObject<WebmentionAuthor> {
  private constructor(private readonly fields: AuthorFields) {}

  static create(params: {
    name?: string;
    url?: WebmentionUrl;
    photo?: WebmentionUrl;
  }): WebmentionAuthor {
    const name = params.name === undefined ? undefined : toPlainText(params.name, MAX_NAME_LENGTH);

    return new WebmentionAuthor({
      name: name === undefined || name.length === 0 ? undefined : name,
      url: params.url,
      photo: params.photo,
    });
  }

  /** 何も名乗らなかった送り手。 */
  static anonymous(): WebmentionAuthor {
    return this.create({});
  }

  /**
   * D1 の行から戻す。壊れた URL は捨てて、名前だけでも残す。
   *
   * 名前は均し直さない。保存の時点で均してあるので、読むたびに掛け直すと**読んだ値が
   * 保存した値と変わる** (均した結果に残った `<` を、タグの始まりと見なして落とす)。
   */
  static reconstruct(params: {
    name: string | null;
    url: string | null;
    photo: string | null;
  }): WebmentionAuthor {
    return new WebmentionAuthor({
      name: params.name === null || params.name.length === 0 ? undefined : params.name,
      url: WebmentionUrl.parse(params.url),
      photo: WebmentionUrl.parse(params.photo),
    });
  }

  get name(): string | undefined {
    return this.fields.name;
  }

  get url(): WebmentionUrl | undefined {
    return this.fields.url;
  }

  get photo(): WebmentionUrl | undefined {
    return this.fields.photo;
  }

  equals(other: WebmentionAuthor): boolean {
    return (
      this.fields.name === other.fields.name &&
      this.fields.url?.toString() === other.fields.url?.toString() &&
      this.fields.photo?.toString() === other.fields.photo?.toString()
    );
  }

  toJSON(): {
    name: string | null;
    url: string | null;
    photo: string | null;
  } {
    return {
      name: this.fields.name ?? null,
      url: this.fields.url?.toString() ?? null,
      photo: this.fields.photo?.toString() ?? null,
    };
  }
}
