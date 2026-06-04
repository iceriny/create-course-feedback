import { v4 as uuidv4 } from "uuid";
import type { Message } from "../../AI_API/API";
import type { PromptTrace } from "../../domain/ai";

export interface BuildPromptTraceInput {
  blockedStudentNames: string[];
  coursePromptContext: string;
  messages: Message[];
  now?: Date;
  studentName: string;
}

export const buildPromptTrace = ({
  blockedStudentNames,
  coursePromptContext,
  messages,
  now = new Date(),
  studentName,
}: BuildPromptTraceInput): PromptTrace => {
  return {
    id: uuidv4(),
    createdAt: now.toISOString(),
    studentName,
    coursePromptContext,
    messages,
    contextPolicy: {
      allowedStudentName: studentName,
      blockedStudentNames,
      classContextUse: "course_background_only",
      currentInputPriority: "always",
    },
  };
};
