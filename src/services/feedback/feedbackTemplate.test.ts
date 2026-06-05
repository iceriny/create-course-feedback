import dayjs from "dayjs";
import { describe, expect, it } from "vitest";

import type { CourseTemplateContext } from "../../domain/course";
import type { StudentBasicInfo, StudentsInfo } from "../../components/types";
import {
  buildFeedbackBatchMarkdown,
  buildStudentFeedbackMarkdown,
  cleanGeneratedFeedback,
} from "./feedbackTemplate";

const courseContext: CourseTemplateContext = {
  className: "A1",
  courseName: "Scratch",
  courseContentItems: [{ item: "变量" }],
  courseObjectiveItems: [{ item: "理解变量" }],
  courseContents: ["- 变量\n"],
  courseObjectives: ["- 理解变量\n"],
  courseTime: [dayjs("2026-06-01T08:00:00"), dayjs("2026-06-01T09:50:00")],
};

const students: StudentBasicInfo[] = [
  { name: "张三", gender: "male", version: "v2" },
  { name: "李四", gender: "female", version: "v1" },
];

const studentsInfo: Record<number, StudentsInfo> = {
  0: {
    name: "张三",
    content: "表现积极",
    think_content: "",
    loading: false,
    activated: true,
  },
  1: {
    name: "李四",
    content: "",
    think_content: "",
    loading: false,
    activated: false,
  },
};

describe("feedback template service", () => {
  it("builds single student markdown with template variables", () => {
    expect(
      buildStudentFeedbackMarkdown({
        courseContext,
        customTemplate:
          "{{studentName}}|{{courseName}}|{{courseFeedback}}|{{signature}}",
        signature: "老师",
        student: students[0],
        studentInfo: studentsInfo[0],
      }),
    ).toContain("### 张三\n张三|《Scratch》|表现积极|老师");
  });

  it("filters inactive or empty feedback when requested", () => {
    const result = buildFeedbackBatchMarkdown({
      courseContext,
      customTemplate: "{{studentName}}:{{courseFeedback}}",
      signature: "老师",
      students,
      studentsInfo,
      onlyReadyAndActivated: true,
    });

    expect(result).toContain("张三:表现积极");
    expect(result).not.toContain("李四");
  });

  it("cleans generated text that includes template residue", () => {
    expect(
      cleanGeneratedFeedback(
        "**课堂表现:** 表现积极\n2026年 6月1日\n哆啦人工智能小栈",
      ),
    ).toBe("表现积极");
  });
});
