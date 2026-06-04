import { describe, expect, it } from "vitest";

import { buildPromptTrace } from "./promptTrace";

describe("prompt trace", () => {
  it("records messages and context policy for a single student", () => {
    const trace = buildPromptTrace({
      blockedStudentNames: ["李四"],
      coursePromptContext: "课程背景",
      messages: [{ role: "user", content: "表现积极" }],
      now: new Date("2026-06-04T08:00:00.000Z"),
      studentName: "张三",
    });

    expect(trace.id).toEqual(expect.any(String));
    expect(trace).toMatchObject({
      createdAt: "2026-06-04T08:00:00.000Z",
      studentName: "张三",
      contextPolicy: {
        allowedStudentName: "张三",
        blockedStudentNames: ["李四"],
        classContextUse: "course_background_only",
        currentInputPriority: "always",
      },
      messages: [{ role: "user", content: "表现积极" }],
    });
  });
});
