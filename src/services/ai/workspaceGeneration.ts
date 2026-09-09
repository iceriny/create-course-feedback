import dayjs from "dayjs";
import API from "../../AI_API/API";
import { useRosterStore } from "../../store/rosterStore";
import { useSettingsStore } from "../../store/settingsStore";
import { buildCourseTemplateContext } from "../../domain/course";
import { formatStructuredStudentPerformance } from "../../domain/student";
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
export const courseContext = () => {
  const { activeClass, course } = useRosterStore.getState();
  return buildCourseTemplateContext({
    "class-name": activeClass,
    "course-name": course.name,
    "course-time": [dayjs(course.start), dayjs(course.end)],
    "course-contents": course.contents.split("\n"),
    "course-objectives": course.objectives.split("\n"),
  });
};
export const hasObservation = (index: number) => {
  const { studentsList, studentsInfo } = useRosterStore.getState();
  const performance = studentsInfo[index]?.performance || {};
  return studentsList[index]?.version === "v1"
    ? Boolean(performance.brief?.trim())
    : ["total", "mastery_situation", "attention", "interaction", "other"].some(
        (key) => performance[key]?.trim(),
      );
};
export function generateFeedback(indices: number[]) {
  const state = useRosterStore.getState();
  const context = courseContext();
  if (
    !context ||
    !state.course.start ||
    !state.course.end ||
    !dayjs(state.course.end).isAfter(dayjs(state.course.start))
  )
    throw new Error("请补全课程信息，并确认结束时间晚于开始时间。");
  if (!API.tokenReady()) throw new Error("请先在设置中保存 AI 密钥。");
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
    if (!student || !info?.activated || info.loading || !hasObservation(index))
      continue;
    const performanceText =
      student.version === "v1"
        ? info.performance?.brief || ""
        : formatStructuredStudentPerformance(
            student.gender,
            info.performance || {},
          );
    const lessonId = state.lessonId;
    let taskId: string | undefined;
    orchestrator.queueStudentGeneration({
      index,
      systemPrompt: settings.promptItems[settings.promptKey].prompt,
      contextPlan: planStudentGenerationContext({
        student,
        students: state.studentsList,
        performanceText,
        coursePromptContext: compileCoursePromptContext(context),
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
        current.updateStudentInfo(target, patch);
      },
    });
    queued++;
  }
  return queued;
}
