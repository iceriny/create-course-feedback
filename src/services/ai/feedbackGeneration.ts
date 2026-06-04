import API from "../../AI_API/API";
import type { ContentType, Message } from "../../AI_API/API";
import type { StudentBasicInfo, StudentsInfo } from "../../components/types";
import { formatStructuredStudentPerformance } from "../../domain/student";
import { cleanGeneratedFeedback } from "../feedback/feedbackTemplate";
import { buildStudentGenerationMessages } from "../prompt/promptCompiler";
import { buildPromptTrace } from "./promptTrace";
import { validateGeneratedFeedback } from "./outputValidator";

export interface StudentPerformanceFormReader {
  getFieldValue: (name: (string | number)[]) => unknown;
}

export type StudentInfoUpdater = (
  index: number,
  info: Partial<StudentsInfo> | ((prev: StudentsInfo) => StudentsInfo),
) => void;

const readStringField = (
  form: StudentPerformanceFormReader,
  name: (string | number)[],
) => {
  const value = form.getFieldValue(name);
  return typeof value === "string" ? value : "";
};

export const getStudentPerformanceText = (
  form: StudentPerformanceFormReader,
  student: StudentBasicInfo,
  index: number,
) => {
  if (student.version === "v1") {
    return readStringField(form, ["content", index]);
  }

  return formatStructuredStudentPerformance(student.gender, {
    total: readStringField(form, ["content", index, "total"]),
    mastery_situation: readStringField(form, [
      "content",
      index,
      "mastery_situation",
    ]),
    attention: readStringField(form, ["content", index, "attention"]),
    interaction: readStringField(form, ["content", index, "interaction"]),
    other: readStringField(form, ["content", index, "other"]),
  });
};

export interface StudentFeedbackGenerationInput {
  api?: Pick<API, "sendMessage">;
  blockedStudentNames: string[];
  coursePromptContext: string;
  form: StudentPerformanceFormReader;
  index: number;
  student: StudentBasicInfo;
  systemPrompt: string;
  updateStudentInfo: StudentInfoUpdater;
}

export const buildStudentFeedbackGenerationMessages = ({
  coursePromptContext,
  form,
  index,
  student,
  systemPrompt,
}: Pick<
  StudentFeedbackGenerationInput,
  "coursePromptContext" | "form" | "index" | "student" | "systemPrompt"
>) => {
  return buildStudentGenerationMessages({
    systemPrompt,
    coursePromptContext,
    student,
    performanceText: getStudentPerformanceText(form, student, index),
  });
};

export const createStudentFeedbackStreamHandlers = (
  index: number,
  student: StudentBasicInfo,
  blockedStudentNames: string[],
  updateStudentInfo: StudentInfoUpdater,
) => {
  let failed = false;

  return {
    onContent: (content: string | null, type?: ContentType) => {
      if (type === null || content === null) {
        failed = true;
        updateStudentInfo(index, (prevInfo) => ({
          ...prevInfo,
          generation: {
            ...prevInfo.generation,
            errorMessage: "生成失败，请稍后重试。",
            finishedAt: new Date().toISOString(),
            status: "failed",
          },
          loading: false,
        }));
        return;
      }

      switch (type) {
        case "content":
          updateStudentInfo(index, { content });
          break;
        case "reasoning_content":
          updateStudentInfo(index, { think_content: content });
          break;
        default:
          console.warn("未知的type");
          break;
      }
    },
    onFinish: () => {
      if (failed) return;

      updateStudentInfo(index, (prevInfo) => {
        const cleanedContent = cleanGeneratedFeedback(prevInfo.content || "");
        const quality = validateGeneratedFeedback({
          allowedStudentName: student.name,
          blockedStudentNames,
          content: cleanedContent,
        });

        return {
          ...prevInfo,
          content: cleanedContent,
          generation: {
            ...prevInfo.generation,
            finishedAt: quality.checkedAt,
            quality,
            status: quality.status === "pass" ? "ready" : "needs_review",
          },
          loading: false,
        };
      });
    },
  };
};

export const startStudentFeedbackGeneration = ({
  api = new API(),
  blockedStudentNames,
  coursePromptContext,
  form,
  index,
  student,
  systemPrompt,
  updateStudentInfo,
}: StudentFeedbackGenerationInput) => {
  const messages: Message[] = buildStudentFeedbackGenerationMessages({
    coursePromptContext,
    form,
    index,
    student,
    systemPrompt,
  });
  const trace = buildPromptTrace({
    blockedStudentNames,
    coursePromptContext,
    messages,
    studentName: student.name,
  });

  updateStudentInfo(index, {
    generation: {
      startedAt: trace.createdAt,
      status: "generating",
      trace,
    },
    loading: true,
  });

  const { onContent, onFinish } = createStudentFeedbackStreamHandlers(
    index,
    student,
    blockedStudentNames,
    updateStudentInfo,
  );

  api.sendMessage(onContent, onFinish, ...messages);
};
