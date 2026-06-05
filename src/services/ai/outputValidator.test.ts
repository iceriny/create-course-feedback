import { describe, expect, it } from "vitest";

import { validateGeneratedFeedback } from "./outputValidator";

describe("output validator", () => {
  it("passes clear feedback content", () => {
    expect(
      validateGeneratedFeedback({
        allowedStudentName: "张三",
        blockedStudentNames: ["李四"],
        content:
          "张三本节课表现积极，能够跟随老师完成变量练习，并主动分享自己的想法。",
        now: new Date("2026-06-04T08:00:00.000Z"),
      }),
    ).toEqual({
      checkedAt: "2026-06-04T08:00:00.000Z",
      issues: [],
      status: "pass",
    });
  });

  it("flags leakage and template residue", () => {
    const report = validateGeneratedFeedback({
      allowedStudentName: "张三",
      blockedStudentNames: ["李四"],
      content: "课程名称：Scratch。李四一直没有完成练习。",
      now: new Date("2026-06-04T08:00:00.000Z"),
    });

    expect(report.status).toBe("review");
    expect(report.issues.map((issue) => issue.code)).toEqual([
      "other_student_name",
      "template_residue",
      "absolute_word",
    ]);
  });
});
