import type { Message } from "../AI_API/API";

export type FeedbackGenerationStatus =
  | "idle"
  | "generating"
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

export interface PromptTrace {
  id: string;
  createdAt: string;
  studentName: string;
  coursePromptContext: string;
  messages: Message[];
  contextPolicy: {
    allowedStudentName: string;
    blockedStudentNames: string[];
    classContextUse: "course_background_only";
    currentInputPriority: "always";
  };
}

export interface FeedbackGenerationState {
  errorMessage?: string;
  finishedAt?: string;
  quality?: FeedbackQualityReport;
  startedAt?: string;
  status: FeedbackGenerationStatus;
  trace?: PromptTrace;
}
