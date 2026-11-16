import type { IValueObject } from "~/backend/domain/shared";

/*
 * 作品のスクリーンショット 1 枚。
 *
 * **`alt` は省略できない。** スクリーンショットは飾りではなく「どんなものか」を伝える
 * 中身なので、何が写っているかを字でも持つ。
 *
 * `kind` は枠の比率を決める。横長のデスクトップ画面と縦長のスマートフォン画面を同じ枠に
 * 入れると、どちらかが小さくなる。
 *
 * 寸法は同期のときに画像のヘッダーから読んで添える。判別できない形式では持たない
 * (誤った寸法で見た目を壊すより、付けないほうが安全)。
 */
const MAX_SRC_LENGTH = 2048;
const MAX_ALT_LENGTH = 300;

export const workScreenshotKinds = ["desktop", "mobile"] as const;
export type WorkScreenshotKind = (typeof workScreenshotKinds)[number];

export function isWorkScreenshotKind(value: unknown): value is WorkScreenshotKind {
  return workScreenshotKinds.some((kind) => kind === value);
}

export class InvalidWorkScreenshotError extends Error {
  readonly name = "InvalidWorkScreenshotError";
}

export interface WorkScreenshotDimensions {
  readonly width: number;
  readonly height: number;
}

interface WorkScreenshotFields {
  readonly src: string;
  readonly alt: string;
  readonly kind: WorkScreenshotKind;
  readonly dimensions: WorkScreenshotDimensions | undefined;
}

export class WorkScreenshot implements IValueObject<WorkScreenshot> {
  private constructor(private readonly fields: WorkScreenshotFields) {}

  static create(params: {
    src: string;
    alt: string;
    kind?: WorkScreenshotKind;
    dimensions?: WorkScreenshotDimensions;
  }): WorkScreenshot {
    return new WorkScreenshot({
      src: requireSrc(params.src),
      alt: requireAlt(params.alt),
      kind: params.kind ?? "desktop",
      dimensions:
        params.dimensions === undefined ? undefined : requireDimensions(params.dimensions),
    });
  }

  /**
   * 置き場と寸法が分かった姿を返す (非破壊)。
   *
   * 原文に書いてあるのは作品の置き場からの相対パスで、配る URL と寸法は同期が決める。
   */
  locatedAt(params: { src: string; dimensions?: WorkScreenshotDimensions }): WorkScreenshot {
    return WorkScreenshot.create({
      src: params.src,
      alt: this.fields.alt,
      kind: this.fields.kind,
      dimensions: params.dimensions,
    });
  }

  get src(): string {
    return this.fields.src;
  }

  get alt(): string {
    return this.fields.alt;
  }

  get kind(): WorkScreenshotKind {
    return this.fields.kind;
  }

  /** 寸法を読めなかった画像では undefined。 */
  get dimensions(): WorkScreenshotDimensions | undefined {
    return this.fields.dimensions;
  }

  equals(other: WorkScreenshot): boolean {
    return (
      this.fields.src === other.fields.src &&
      this.fields.alt === other.fields.alt &&
      this.fields.kind === other.fields.kind &&
      this.fields.dimensions?.width === other.fields.dimensions?.width &&
      this.fields.dimensions?.height === other.fields.dimensions?.height
    );
  }

  toJSON(): Record<string, unknown> {
    return {
      src: this.fields.src,
      alt: this.fields.alt,
      kind: this.fields.kind,
      width: this.fields.dimensions?.width,
      height: this.fields.dimensions?.height,
    };
  }
}

function requireSrc(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_SRC_LENGTH) {
    throw new InvalidWorkScreenshotError(
      `Work screenshot src must be 1..${String(MAX_SRC_LENGTH)} characters long`,
    );
  }
  return trimmed;
}

function requireAlt(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > MAX_ALT_LENGTH) {
    throw new InvalidWorkScreenshotError(
      `Work screenshot alt must be 1..${String(MAX_ALT_LENGTH)} characters long`,
    );
  }
  return trimmed;
}

function requireDimensions(raw: WorkScreenshotDimensions): WorkScreenshotDimensions {
  const isValid = [raw.width, raw.height].every((side) => Number.isInteger(side) && side > 0);
  if (!isValid) {
    throw new InvalidWorkScreenshotError(
      `Work screenshot dimensions must be positive integers, got ${String(raw.width)}x${String(raw.height)}`,
    );
  }
  return { width: raw.width, height: raw.height };
}
