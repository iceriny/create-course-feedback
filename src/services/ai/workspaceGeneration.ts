import API from "../../AI_API/API";
import { useRosterStore } from "../../store/rosterStore";
import { useSettingsStore } from "../../store/settingsStore";
import {
  getCourseIssues,
  lessonCourseContext,
  type CourseField,
} from "../../domain/course";
import type { LessonCourse } from "../../domain/lesson";
import {
  canGenerateFeedback,
  markFeedbackForUpdate,
} from "../../domain/feedbackStatus";
import { formatStructuredStudentPerformance } from "../../domain/student";
import type { StudentBasicInfo, StudentsInfo } from "../../types";
import { compileCoursePromptContext } from "../prompt/promptCompiler";
import {
  createGenerationOrchestrator,
  type GenerationOrchestrator,
} from "./generationOrchestrator";
import { planStudentGenerationContext } from "./contextPlanner";

let orchestrator: GenerationOrchestrator | undefined;
let session = "";
export const cancelGeneration = () => {
  orchestrator?.cancelAll();
  orchestrator = undefined;
  session = "";
};
export const cancelStudentGeneration = (studentId: string) =>
  orchestrator?.cancelStudent(studentId);

export const courseContext = () => {
  const { activeClass, course } = useRosterStore.getState();
  return lessonCourseContext(activeClass, course);
};

export type AiSetupField = "token" | "endpoint" | "model";
export type GenerationIssue =
  | { section: "course"; field: CourseField; message: string }
  | { section: "settings"; field: AiSetupField; message: string };

export function getGenerationIssues(
  course: LessonCourse = useRosterStore.getState().course,
): GenerationIssue[] {
  const { config, model, token } = API.snapshot();
  const issues: GenerationIssue[] = getCourseIssues(course).map((issue) => ({
    ...issue,
    section: "course",
  }));
  if (!token)
    issues.push({
      section: "settings",
      field: "token",
      message: "配置 AI 服务与密钥",
    });
  else if (!config.apiUrl.trim())
    issues.push({
      section: "settings",
      field: "endpoint",
      message: "填写 AI 生成地址",
    });
  else if (!model.trim())
    issues.push({
      section: "settings",
      field: "model",
      message: "选择 AI 模型",
    });
  return issues;
}

const observationText = (student: StudentBasicInfo, info: StudentsInfo) => {
  const performance = info.performance ?? {};
  return student.version === "v1"
    ? performance.brief?.trim() || ""
    : formatStructuredStudentPerformance(student.gender, performance);
};

export function generateFeedback(indices: number[]) {
  const state = useRosterStore.getState();
  const context = courseContext();
  const issue = getGenerationIssues()[0];
  if (issue || !context) throw new Error(issue?.message ?? "请补全本次课程。");
  const coursePromptContext = compileCoursePromptContext(context);
  const settings = useSettingsStore.getState();
  const key = `${state.lessonId}:${API.getProvider()}:${API.getModel()}:${settings.promptKey}`;
  if (key !== session) {
    cancelGeneration();
    session = key;
  }
  orchestrator ??= createGenerationOrchestrator({
    updateStudentInfo: () => {},
    promptRecipe: {
      id: settings.promptKey,
      name: settings.promptItems[settings.promptKey].name,
    },
  });
  let queued = 0;
  for (const index of indices) {
    const student = state.studentsList[index];
    const info = state.studentsInfo[index];
    if (!student || !info || !canGenerateFeedback(student, info)) continue;
    const performanceText = observationText(student, info);
    const lessonId = state.lessonId;
    let taskId: string | undefined;
    orchestrator.queueStudentGeneration({
      index,
      systemPrompt: settings.promptItems[settings.promptKey].prompt,
      contextPlan: planStudentGenerationContext({
        student,
        students: state.studentsList,
        performanceText,
        coursePromptContext,
      }),
      update: (patch) => {
        const current = useRosterStore.getState();
        if (current.lessonId !== lessonId) return;
        const target = current.studentsList.findIndex(
          (item) => item.id === student.id,
        );
        if (target < 0) return;
        const previous = current.studentsInfo[target];
        if (taskId && previous.generation?.taskId !== taskId) return;
        if (!taskId && typeof patch !== "function")
          taskId = patch.generation?.taskId;
        if (typeof patch !== "function") {
          current.updateStudentInfo(target, patch);
          return;
        }
        current.updateStudentInfo(target, (prev) => {
          const next = patch(prev);
          if (next.loading || next.generation?.status === "failed") return next;

          const currentContext = courseContext();
          const currentStudent = current.studentsList[target];
          const courseChanged =
            !currentContext ||
            compileCoursePromptContext(currentContext) !== coursePromptContext;
          const studentChanged =
            currentStudent.name !== student.name ||
            currentStudent.gender !== student.gender;
          const observationChanged =
            currentStudent.version !== student.version ||
            observationText(currentStudent, prev) !== performanceText;
          if (courseChanged || studentChanged || observationChanged) {
            const reason = courseChanged
              ? "course"
              : studentChanged
                ? "student"
                : "observation";
            if (!prev.content.trim())
              return markFeedbackForUpdate(next, reason);
            return {
              ...markFeedbackForUpdate(prev, reason),
              loading: false,
              draftContent: undefined,
              generation: {
                status:
                  prev.generation?.quality?.status === "review"
                    ? "needs_review"
                    : "ready",
              },
            };
          }
          return {
            ...next,
            feedbackNeedsUpdate: undefined,
            previousFeedbackNeedsUpdate: prev.content.trim()
              ? prev.feedbackNeedsUpdate
              : prev.previousFeedbackNeedsUpdate,
          };
        });
      },
    });
    queued++;
  }
  return queued;
}
