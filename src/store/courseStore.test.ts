import dayjs from "dayjs";
import { beforeEach, describe, expect, it } from "vitest";

import type { CourseTemplateContext } from "../domain/course";
import { installMemoryStorage } from "../test/memoryStorage";
import { useCourseStore } from "./courseStore";

const courseContext: CourseTemplateContext = {
  className: "cpp0608",
  courseContentItems: [{ item: "变量与循环" }],
  courseContents: ["- 变量与循环\n"],
  courseName: "Scratch 编程",
  courseObjectiveItems: [{ item: "理解重复执行" }],
  courseObjectives: ["- 理解重复执行\n"],
  courseTime: [dayjs("2026-05-28 08:00"), dayjs("2026-05-28 10:50")],
};
const courseHistoryKey = courseContext.courseTime[0].toISOString();

describe("course store", () => {
  beforeEach(() => {
    installMemoryStorage();
    localStorage.clear();
    useCourseStore.setState({ classList: [], history: {} });
  });

  it("hydrates class list and migrates course history", () => {
    localStorage.setItem("class-name", JSON.stringify(["cpp0608"]));
    localStorage.setItem(
      "class-history",
      JSON.stringify({
        old: {
          courseName: "旧课程",
          courseContents: [{ item: "旧内容" }],
          courseObjectives: [{ item: "旧目标" }],
        },
      }),
    );

    const result = useCourseStore.getState().hydrateCourseState();

    expect(result.migrated).toBe(true);
    expect(useCourseStore.getState().classList).toEqual(["cpp0608"]);
    expect(Object.values(useCourseStore.getState().history)[0]).toMatchObject({
      courseContents: [{ item: "旧内容" }],
      courseObjectives: [{ item: "旧目标" }],
      courseName: "旧课程",
    });
  });

  it("saves course context as the course state source", () => {
    useCourseStore.getState().saveCourseContext(courseContext);

    expect(useCourseStore.getState().classList).toEqual(["cpp0608"]);
    expect(useCourseStore.getState().history[courseHistoryKey]).toMatchObject({
      courseContents: [{ item: "变量与循环" }],
      courseName: "Scratch 编程",
    });
    expect(useCourseStore.getState().readStoredClassTime("cpp0608")).toEqual({
      time: {
        first: "2026-05-28 08:00",
        last: "2026-05-28 10:50",
      },
    });
  });

  it("removes history items through the store", () => {
    useCourseStore.getState().saveCourseContext(courseContext);
    useCourseStore.getState().removeHistoryItem(courseHistoryKey);

    expect(useCourseStore.getState().history).toEqual({});
  });
});
