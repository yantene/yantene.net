import { describe, expect, it } from "vitest";
import { LifeEventDate } from "./life-event-date.vo";
import { InvalidLifeEventError, LifeEvent } from "./life-event.vo";

const date = LifeEventDate.create("2012-04");

describe("LifeEvent", () => {
  it("keeps the kind, the title and the description", () => {
    const event = LifeEvent.create({
      date,
      kind: "school-entry",
      title: "大学入学",
      description: "情報系に進んだ。",
    });
    expect(event.kind).toBe("school-entry");
    expect(event.title).toBe("大学入学");
    expect(event.description).toBe("情報系に進んだ。");
  });

  /** 説明を書かなかったのと空文字を分けない。描画側が両方を気にせずに済む。 */
  it("treats an empty description as absent", () => {
    expect(
      LifeEvent.create({ date, kind: "birth", title: "生誕", description: "  " }).description,
    ).toBeUndefined();
    expect(LifeEvent.create({ date, kind: "birth", title: "生誕" }).description).toBeUndefined();
  });

  it("rejects a kind that is not an identifier", () => {
    for (const kind of ["", "School Entry", "学校", "school_entry"]) {
      expect(() => LifeEvent.create({ date, kind, title: "題" })).toThrow(InvalidLifeEventError);
    }
  });

  it("rejects an empty title", () => {
    expect(() => LifeEvent.create({ date, kind: "birth", title: "   " })).toThrow(
      InvalidLifeEventError,
    );
  });
});
