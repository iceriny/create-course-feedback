import type { Message } from "../AI_API/API";
import type { ModelType, ProviderType } from "../AI_API/API";

export type FeedbackGenerationStatus =
  | "idle"
  | "queued"
  | "generating"
  | "retrying"
  | "ready"
  | "needs_review"
  | "failed";

export type FeedbackQualitySeverity = "warning" | "error";

export interface FeedbackQualityIssue {
  code:
    | "empty"
    | "too_short"
    | "other_student_name"
    | "template_residue"
    | "absolute_word";
  message: string;
  severity: FeedbackQualitySeverity;
}

export interface FeedbackQualityReport {
  checkedAt: string;
  issues: FeedbackQualityIssue[];
  status: "pass" | "review";
}

export interface StudentGenerationContextPolicy {
  allowedStudentName: string;
  blockedStudentNames: string[];
  classContextUse: "course_background_only";
  currentInputPriority: "always";
}

export interface PromptTraceOutput {
  content?: string;
  errorMessage?: string;
  finishedAt?: string;
  quality?: FeedbackQualityReport;
  status?: FeedbackGenerationStatus;
  thinkContent?: string;
}

export interface PromptRecipeSnapshot {
  id: string;
  name: string;
}

export interface PromptTrace {
  attempt: number;
  id: string;
  createdAt: string;
  studentName: string;
  coursePromptContext: string;
  messages: Message[];
  contextPolicy: StudentGenerationContextPolicy;
  model?: ModelType;
  output?: PromptTraceOutput;
  promptRecipe?: PromptRecipeSnapshot;
  provider?: ProviderType;
  taskId?: string;
  updatedAt?: string;
}

export type GenerationTaskStatus =
  | "queued"
  | "running"
  | "retrying"
  | "succeeded"
  | "failed";

export interface GenerationTaskSnapshot {
  attempt: number;
  errorMessage?: string;
  finishedAt?: string;
  id: string;
  maxAttempts: number;
  queuedAt: string;
  startedAt?: string;
  status: GenerationTaskStatus;
  studentIndex: number;
  studentName: string;
  traceId?: string;
}

export interface FeedbackGenerationState {
  attempt?: number;
  errorMessage?: string;
  finishedAt?: string;
  lastAttemptAt?: string;
  maxAttempts?: number;
  quality?: FeedbackQualityReport;
  queuedAt?: string;
  startedAt?: string;
  status: FeedbackGenerationStatus;
  taskId?: string;
  trace?: PromptTrace;
}
