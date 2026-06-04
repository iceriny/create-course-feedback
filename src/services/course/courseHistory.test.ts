import dayjs from "dayjs";
import { describe, expect, it } from "vitest";

import type { CourseTemplateContext } from "../../domain/course";
import {
  addCourseContextToHistory,
  buildClassTimeFromCourseContext,
  migrateCourseHistory,
  parseStoredClassTime,
  removeCourseHistoryItem,
  shiftClassTimeToPreviousWeek,
} from "./courseHistory";

const courseContext: CourseTemplateContext = {
  className: "A1",
  courseName: "Scratch",
  courseContentItems: [{ item: "变量" }],
  courseObjectiveItems: [{ item: "理解变量" }],
  courseContents: ["- 变量\n"],
  courseObjectives: ["- 理解变量\n"],
  courseTime: [dayjs("2026-06-01T08:00:00"), dayjs("2026-06-01T09:50:00")],
};

describe("course history service", () => {
  it("migrates legacy history keys to date keys", () => {
    const { history, migrated } = migrateCourseHistory(
      {
        legacyId: {
          courseName: "Scratch",
          courseContents: [{ item: "变量" }],
          courseObjectives: [{ item: "理解变量" }],
        },
      },
      dayjs("2000-01-01T00:00:00.000Z"),
    );

    expect(migrated).toBe(true);
    expect(Object.keys(history)).toEqual(["2000-01-01T00:00:00.000Z"]);
    expect(history["2000-01-01T00:00:00.000Z"].time).toEqual([
      "2000-01-01T00:00:00.000Z",
      "2000-01-01T00:00:00.000Z",
    ]);
  });

  it("builds class time and appends bounded history entries", () => {
    expect(buildClassTimeFromCourseContext(courseContext)).toEqual({
      time: {
        first: "2026-06-01 08:00",
        last: "2026-06-01 09:50",
      },
    });

    const history = addCourseContextToHistory({}, courseContext, 1);
    expect(history[courseContext.courseTime[0].toISOString()]).toMatchObject({
      courseName: "Scratch",
      courseContents: [{ item: "变量" }],
    });

    expect(
      removeCourseHistoryItem(
        history,
        courseContext.courseTime[0].toISOString(),
      ),
    ).toEqual({});
  });

  it("parses stored class time and shifts it to previous week same weekday", () => {
    const classTime = parseStoredClassTime(
      JSON.stringify({
        time: { first: "2026-06-01 08:00", last: "2026-06-01 09:50" },
      }),
    );

    expect(classTime).toEqual({
      time: { first: "2026-06-01 08:00", last: "2026-06-01 09:50" },
    });

    const [first, last] = shiftClassTimeToPreviousWeek(
      classTime!,
      dayjs("2026-06-10T12:00:00"),
    );

    expect(first.format("YYYY-MM-DD HH:mm")).toBe("2026-06-01 08:00");
    expect(last.format("YYYY-MM-DD HH:mm")).toBe("2026-06-01 09:50");
  });
});
