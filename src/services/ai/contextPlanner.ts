import type { StudentBasicInfo } from "../../components/types";
import type { StudentGenerationContextPolicy } from "../../domain/ai";

export interface StudentGenerationContextPlan {
  blockedStudentNames: string[];
  coursePromptContext: string;
  performanceText: string;
  policy: StudentGenerationContextPolicy;
  student: StudentBasicInfo;
}

export interface PlanStudentGenerationContextInput {
  coursePromptContext: string;
  performanceText: string;
  student: StudentBasicInfo;
  students: StudentBasicInfo[];
}

export const planStudentGenerationContext = ({
  coursePromptContext,
  performanceText,
  student,
  students,
}: PlanStudentGenerationContextInput): StudentGenerationContextPlan => {
  const blockedStudentNames = students
    .map((item) => item.name.trim())
    .filter((name) => name && name !== student.name);

  return {
    blockedStudentNames,
    coursePromptContext,
    performanceText,
    policy: {
      allowedStudentName: student.name,
      blockedStudentNames,
      classContextUse: "course_background_only",
      currentInputPriority: "always",
    },
    student,
  };
};
