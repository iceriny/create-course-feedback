import { v4 as uuidv4 } from "uuid";
import type { Message } from "../../AI_API/API";
import type {
  FeedbackGenerationStatus,
  FeedbackQualityReport,
  PromptTrace,
  StudentGenerationContextPolicy,
} from "../../domain/ai";

export interface BuildPromptTraceInput {
  blockedStudentNames: string[];
  contextPolicy?: StudentGenerationContextPolicy;
  coursePromptContext: string;
  messages: Message[];
  metadata?: {
    attempt?: number;
    model?: PromptTrace["model"];
    promptRecipe?: PromptTrace["promptRecipe"];
    provider?: PromptTrace["provider"];
    taskId?: string;
  };
  now?: Date;
  studentName: string;
}

export const buildPromptTrace = ({
  blockedStudentNames,
  contextPolicy,
  coursePromptContext,
  metadata,
  messages,
  now = new Date(),
  studentName,
}: BuildPromptTraceInput): PromptTrace => {
  return {
    attempt: metadata?.attempt ?? 1,
    id: uuidv4(),
    createdAt: now.toISOString(),
    studentName,
    coursePromptContext,
    messages,
    contextPolicy: contextPolicy ?? {
      allowedStudentName: studentName,
      blockedStudentNames,
      classContextUse: "course_background_only",
      currentInputPriority: "always",
    },
    model: metadata?.model,
    promptRecipe: metadata?.promptRecipe,
    provider: metadata?.provider,
    taskId: metadata?.taskId,
  };
};

export interface CompletePromptTraceInput {
  content?: string;
  errorMessage?: string;
  finishedAt?: Date;
  quality?: FeedbackQualityReport;
  status: FeedbackGenerationStatus;
  thinkContent?: string;
  trace: PromptTrace;
}

export const completePromptTrace = ({
  content,
  errorMessage,
  finishedAt = new Date(),
  quality,
  status,
  thinkContent,
  trace,
}: CompletePromptTraceInput): PromptTrace => {
  const finishedAtIso = finishedAt.toISOString();

  return {
    ...trace,
    output: {
      content,
      errorMessage,
      finishedAt: finishedAtIso,
      quality,
      status,
      thinkContent,
    },
    updatedAt: finishedAtIso,
  };
};
