import { describe, expect, it } from "vitest";

import { planStudentGenerationContext } from "./contextPlanner";

describe("context planner", () => {
  it("keeps class context as background and isolates the target student", () => {
    const plan = planStudentGenerationContext({
      coursePromptContext: "课程背景",
      performanceText: "表现积极",
      student: { name: "张三", gender: "male", version: "v2" },
      students: [
        { name: "张三", gender: "male", version: "v2" },
        { name: "李四", gender: "female", version: "v2" },
      ],
    });

    expect(plan).toEqual({
      blockedStudentNames: ["李四"],
      coursePromptContext: "课程背景",
      performanceText: "表现积极",
      policy: {
        allowedStudentName: "张三",
        blockedStudentNames: ["李四"],
        classContextUse: "course_background_only",
        currentInputPriority: "always",
      },
      student: { name: "张三", gender: "male", version: "v2" },
    });
  });
});
