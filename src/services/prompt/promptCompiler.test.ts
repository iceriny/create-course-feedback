import dayjs from "dayjs";
import { describe, expect, it } from "vitest";

import type { CourseTemplateContext } from "../../domain/course";
import {
  buildStudentGenerationMessages,
  compileCoursePromptContext,
} from "./promptCompiler";

const courseContext: CourseTemplateContext = {
  className: "A1",
  courseName: "Scratch",
  courseContentItems: [{ item: "变量" }],
  courseObjectiveItems: [{ item: "理解变量" }],
  courseContents: ["- 变量\n"],
  courseObjectives: ["- 理解变量\n"],
  courseTime: [dayjs("2026-06-01T08:00:00"), dayjs("2026-06-01T09:50:00")],
};

describe("prompt compiler", () => {
  it("compiles course context before sending to the model", () => {
    const promptContext = compileCoursePromptContext(courseContext);

    expect(promptContext).toContain("《Scratch》");
    expect(promptContext).toContain("- 变量");
    expect(promptContext).not.toContain("{{courseName}}");
  });

  it("builds isolated single-student generation messages", () => {
    expect(
      buildStudentGenerationMessages({
        systemPrompt: "请写反馈",
        coursePromptContext: "课程背景",
        student: { name: "张三", gender: "male", version: "v2" },
        performanceText: "表现积极",
      }),
    ).toEqual([
      { role: "system", content: "请写反馈" },
      { role: "user", content: "课程背景" },
      { role: "user", content: "学员姓名: 张三" },
      { role: "user", content: "表现积极" },
    ]);
  });
});
