import type { HistoryDate } from "~/backend/domain/profile";
import type { IValueObject } from "~/backend/domain/shared";
import { spanEndViolation } from "~/backend/domain/profile";

/*
 * 作った時期、または運用した期間。
 *
 * **日の書式と終わりの決まりは経歴のものをそのまま使う** (`HistoryDate` /
 * `spanEndViolation`)。3 段の精度 (年だけ・月まで・日まで) で、終わりは始まりと同じ
 * 精度で後。同じサイトの中で日の書き方が 2 通りあると、書き手がどちらだったかを毎回
 * 確かめることになる。
 *
 * ⚠️ **並べ替えには使わない。** 作品の並びは `position` が決める (ADR 0042)。ここに
 * 日付があるからといって作った順に並べると、一覧が年表になる。
 */
export class InvalidWorkPeriodError extends Error {
  readonly name = "InvalidWorkPeriodError";
}

export class WorkPeriod implements IValueObject<WorkPeriod> {
  private constructor(
    private readonly start: HistoryDate,
    private readonly end: HistoryDate | undefined,
  ) {}

  static create(params: { from: HistoryDate; until?: HistoryDate }): WorkPeriod {
    if (params.until !== undefined) {
      const violation = spanEndViolation(params.from, params.until);
      if (violation !== undefined) {
        throw new InvalidWorkPeriodError(`Work period until ${violation}`);
      }
    }
    return new WorkPeriod(params.from, params.until);
  }

  get from(): HistoryDate {
    return this.start;
  }

  /** 書いていなければ undefined。始まりだけが出る。 */
  get until(): HistoryDate | undefined {
    return this.end;
  }

  equals(other: WorkPeriod): boolean {
    return this.start.equals(other.start) && this.end?.toString() === other.end?.toString();
  }

  toJSON(): { from: string; until: string | undefined } {
    return { from: this.start.toJSON(), until: this.end?.toJSON() };
  }
}
