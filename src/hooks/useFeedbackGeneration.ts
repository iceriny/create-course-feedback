import { useCallback, useMemo } from "react";
import type { JointContent } from "antd/es/message/interface";
import type { FormInstance } from "antd/es/form";

import { API } from "../AI_API";
import type {
  PromptItem,
  PromptType,
  StudentBasicInfo,
  StudentsInfo,
} from "../components/types";
import {
  startStudentFeedbackGeneration,
  type StudentInfoUpdater,
} from "../services/ai/feedbackGeneration";
import { createGenerationOrchestrator } from "../services/ai/generationOrchestrator";
import { useAIStore } from "../store/aiStore";

interface UseFeedbackGenerationParams {
  contentForm: FormInstance;
  ensureCourseSaved: () => void;
  getCoursePromptContext: () => string | null;
  isCourseSavedRef: React.MutableRefObject<boolean>;
  prompt: string;
  promptKey: PromptType;
  promptItem: PromptItem;
  sendWarning: (
    content: JointContent,
    duration?: number | VoidFunction,
    onClose?: VoidFunction,
  ) => void;
  studentsInfo: Record<number, StudentsInfo>;
  studentsList: StudentBasicInfo[];
  updateStudentInfo: StudentInfoUpdater;
}

export const useFeedbackGeneration = ({
  contentForm,
  ensureCourseSaved,
  getCoursePromptContext,
  isCourseSavedRef,
  prompt,
  promptItem,
  promptKey,
  sendWarning,
  studentsInfo,
  studentsList,
  updateStudentInfo,
}: UseFeedbackGenerationParams) => {
  const updateGenerationTask = useAIStore(
    (state) => state.updateGenerationTask,
  );
  const promptRecipe = useMemo(
    () => ({
      id: promptKey,
      name: promptItem.name,
    }),
    [promptItem.name, promptKey],
  );

  const orchestrator = useMemo(
    () =>
      createGenerationOrchestrator({
        onTaskChange: updateGenerationTask,
        promptRecipe,
        updateStudentInfo,
      }),
    [promptRecipe, updateGenerationTask, updateStudentInfo],
  );

  const generateSingleFeedback = useCallback(
    (index: number) => {
      const coursePromptContext = getCoursePromptContext();
      if (!coursePromptContext) {
        sendWarning("请先补完整课程信息。");
        return;
      }

      const student = studentsList[index];
      if (!student) return;

      if (!isCourseSavedRef.current) {
        ensureCourseSaved();
      }

      startStudentFeedbackGeneration({
        blockedStudentNames: studentsList
          .map((item) => item.name)
          .filter((name) => name !== student.name),
        coursePromptContext,
        form: contentForm,
        index,
        orchestrator,
        promptRecipe,
        student,
        students: studentsList,
        systemPrompt: prompt,
        updateStudentInfo,
      });
    },
    [
      contentForm,
      ensureCourseSaved,
      getCoursePromptContext,
      isCourseSavedRef,
      orchestrator,
      prompt,
      promptRecipe,
      sendWarning,
      studentsList,
      updateStudentInfo,
    ],
  );

  const generateActivatedFeedback = useCallback(() => {
    if (!getCoursePromptContext()) {
      sendWarning("请先补完整课程信息。");
      return;
    }

    if (API.tokenReady() === false) {
      sendWarning("请先输入API Key.");
      return;
    }

    for (const [index] of studentsList.entries()) {
      if (studentsInfo[index]?.activated) {
        generateSingleFeedback(index);
      }
    }
  }, [
    generateSingleFeedback,
    getCoursePromptContext,
    sendWarning,
    studentsInfo,
    studentsList,
  ]);

  return {
    generateActivatedFeedback,
    generateSingleFeedback,
  };
};

export default useFeedbackGeneration;
