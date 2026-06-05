import dayjs from "dayjs";
import { describe, expect, it } from "vitest";

import {
  buildCourseTemplateContext,
  hasCompleteCourseTime,
  normalizeCourseItems,
} from "./course";

describe("course domain", () => {
  it("normalizes course list items from strings and object values", () => {
    expect(
      normalizeCourseItems(["  第一课  ", { item: " 项目练习 " }, "", {}]),
    ).toEqual([{ item: "第一课" }, { item: "项目练习" }]);
  });

  it("recognizes complete dayjs course time ranges", () => {
    expect(
      hasCompleteCourseTime([dayjs("2026-06-01"), dayjs("2026-06-02")]),
    ).toBe(true);
    expect(hasCompleteCourseTime([dayjs("2026-06-01"), "2026-06-02"])).toBe(
      false,
    );
  });

  it("builds template context only when required fields are present", () => {
    const courseTime = [
      dayjs("2026-06-01T08:00:00"),
      dayjs("2026-06-01T09:50:00"),
    ] as [dayjs.Dayjs, dayjs.Dayjs];

    expect(
      buildCourseTemplateContext({
        "class-name": "  A1  ",
        "course-name": " Scratch ",
        "course-contents": [{ item: "变量" }],
        "course-objectives": ["理解变量"],
        "course-time": courseTime,
      }),
    ).toMatchObject({
      className: "A1",
      courseName: "Scratch",
      courseContents: ["- 变量\n"],
      courseObjectives: ["- 理解变量\n"],
      courseTime,
    });

    expect(
      buildCourseTemplateContext({
        "class-name": "A1",
        "course-name": "",
        "course-contents": [{ item: "变量" }],
        "course-objectives": ["理解变量"],
        "course-time": courseTime,
      }),
    ).toBeNull();
  });
});
