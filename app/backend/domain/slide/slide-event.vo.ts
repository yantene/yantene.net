import type { Temporal } from "@js-temporal/polyfill";
import type { IValueObject } from "~/backend/domain/shared";

/*
 * スライドを使った発表の場。勉強会やカンファレンスの名前と、その日付と、案内のページ。
 *
 * **3 つを 1 つの VO にまとめる。** 日付と URL は「どの場の」が決まって初めて意味を持つ
 * ので、名前の無い日付だけ・URL だけの姿を作れないようにする。発表しなかったスライドも
 * あるので、場そのものの省略は呼び出し側 (エンティティ) が持つ。
 *
 * URL のスキームは http(s) だけ通す。`javascript:` を弾くのが目的で、打ち間違いが
 * そのまま href に乗る経路をドメインの外に作らない (`WorkUrl` と同じ線引き)。
 */
const MAX_NAME_LENGTH = 200;
const MAX_URL_LENGTH = 2048;

export class InvalidSlideEventError extends Error {
  readonly name = "InvalidSlideEventError";
}

export class SlideEvent implements IValueObject<SlideEvent> {
  private constructor(
    readonly name: string,
    /** 発表した日。書いていなければ undefined。 */
    readonly date: Temporal.PlainDate | undefined,
    /** 場の案内のページ。書いていなければ undefined。 */
    readonly url: string | undefined,
  ) {}

  static create(params: { name: string; date?: Temporal.PlainDate; url?: string }): SlideEvent {
    const name = params.name.trim();
    if (name.length === 0 || name.length > MAX_NAME_LENGTH) {
      throw new InvalidSlideEventError(
        `Slide event name must be 1..${String(MAX_NAME_LENGTH)} characters long`,
      );
    }
    return new SlideEvent(
      name,
      params.date,
      params.url === undefined ? undefined : validUrl(params.url),
    );
  }

  equals(other: SlideEvent): boolean {
    return (
      this.name === other.name &&
      this.url === other.url &&
      dateText(this.date) === dateText(other.date)
    );
  }

  toJSON(): { name: string; date: string | null; url: string | null } {
    return { name: this.name, date: dateText(this.date) ?? null, url: this.url ?? null };
  }
}

/** `YYYY-MM-DD`。暦の注釈は付けない。 */
function dateText(date: Temporal.PlainDate | undefined): string | undefined {
  return date?.toString({ calendarName: "never" });
}

function validUrl(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_URL_LENGTH) {
    throw new InvalidSlideEventError(
      `Slide event URL must be 1..${String(MAX_URL_LENGTH)} characters long`,
    );
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new InvalidSlideEventError(`Slide event URL must be an absolute URL, got ${trimmed}`);
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new InvalidSlideEventError(`Slide event URL must be http(s), got ${parsed.protocol}`);
  }
  return trimmed;
}
