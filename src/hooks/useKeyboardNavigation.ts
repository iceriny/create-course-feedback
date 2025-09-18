import { useCallback } from "react";
import { nextFocus } from "../utils";
import type { JointContent } from "antd/es/message/interface";

interface NavigationConfig {
  currentIndex: number;
  fieldIndex?: number;
  totalStudents: number;
  totalFields?: number;
  version: "v1" | "v2";
  sendWarning: (
    content: JointContent,
    duration?: number | VoidFunction,
    onClose?: VoidFunction,
  ) => void;
}

export interface KeyboardHandlers {
  handleEnterKey: (event: React.KeyboardEvent<HTMLInputElement>) => void;
  handleBackspaceKey: (event: React.KeyboardEvent<HTMLInputElement>) => void;
}

/**
 * 键盘导航 Hook - 提供统一的键盘导航逻辑
 */
export function useKeyboardNavigation(
  config: NavigationConfig,
): KeyboardHandlers {
  const {
    currentIndex,
    fieldIndex = 0,
    totalStudents,
    totalFields = 5,
    version,
    sendWarning,
  } = config;

  // 获取输入框ID的辅助函数
  const getInputId = useCallback(
    (studentIndex: number, field?: number) => {
      if (version === "v1") {
        return `student-content-input-${studentIndex}`;
      }
      return `student-content-input-${studentIndex}-${field}`;
    },
    [version],
  );

  // 尝试聚焦到指定输入框
  const tryFocus = useCallback(
    (targetId: string, event: React.KeyboardEvent<HTMLInputElement>) => {
      const target = document.getElementById(targetId) as HTMLInputElement;
      return target && nextFocus(event, target);
    },
    [],
  );

  // 显示边界警告
  const showBoundaryWarning = useCallback(
    (message: string) => {
      sendWarning({
        content: message,
        duration: 1,
        onClose: () => console.log("success"),
      });
    },
    [sendWarning],
  );

  // 处理 Enter 键
  const handleEnterKey = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      event.preventDefault();

      if (version === "v1") {
        // V1版本：跳转到下一个学生
        const nextStudentId = getInputId(currentIndex + 1);
        if (!tryFocus(nextStudentId, event)) {
          showBoundaryWarning("已经是最后一个输入框");
        }
        return;
      }

      // V2版本：处理复杂的导航逻辑
      if (event.shiftKey) return; // Shift+Enter 不跳转

      if (event.altKey) {
        // Alt+Enter：跳转到上一个输入框
        event.preventDefault();
        event.stopPropagation();

        if (fieldIndex > 0) {
          // 同一学生的上一个字段
          const prevFieldId = getInputId(currentIndex, fieldIndex - 1);
          if (!tryFocus(prevFieldId, event)) {
            showBoundaryWarning("导航失败");
          }
        } else if (currentIndex > 0) {
          // 上一个学生的最后一个字段
          const prevStudentLastFieldId = getInputId(
            currentIndex - 1,
            totalFields - 1,
          );
          if (!tryFocus(prevStudentLastFieldId, event)) {
            showBoundaryWarning("已经是第一个输入框");
          }
        } else {
          showBoundaryWarning("已经是第一个输入框");
        }
        return;
      }

      // 普通 Enter：跳转到下一个输入框
      if (fieldIndex < totalFields - 1) {
        // 同一学生的下一个字段
        const nextFieldId = getInputId(currentIndex, fieldIndex + 1);
        if (!tryFocus(nextFieldId, event)) {
          showBoundaryWarning("导航失败");
        }
      } else if (currentIndex < totalStudents - 1) {
        // 下一个学生的第一个字段
        const nextStudentFirstFieldId = getInputId(currentIndex + 1, 0);
        if (!tryFocus(nextStudentFirstFieldId, event)) {
          showBoundaryWarning("已经是最后一个输入框");
        }
      } else {
        showBoundaryWarning("已经是最后一个输入框");
      }
    },
    [
      version,
      currentIndex,
      fieldIndex,
      totalStudents,
      totalFields,
      getInputId,
      tryFocus,
      showBoundaryWarning,
    ],
  );

  // 处理 Backspace 键
  const handleBackspaceKey = useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      const inputElement = event.target as HTMLInputElement;
      if (inputElement.value !== "") return; // 只在输入框为空时处理

      if (version === "v1") {
        // V1版本：跳转到上一个学生
        const prevStudentId = getInputId(currentIndex - 1);
        if (!tryFocus(prevStudentId, event)) {
          showBoundaryWarning("已经是第一个输入框");
        }
        return;
      }

      // V2版本：跳转到上一个字段
      if (fieldIndex > 0) {
        // 同一学生的上一个字段
        const prevFieldId = getInputId(currentIndex, fieldIndex - 1);
        if (!tryFocus(prevFieldId, event)) {
          showBoundaryWarning("导航失败");
        }
      } else if (currentIndex > 0) {
        // 上一个学生的最后一个字段
        const prevStudentLastFieldId = getInputId(
          currentIndex - 1,
          totalFields - 1,
        );
        if (!tryFocus(prevStudentLastFieldId, event)) {
          showBoundaryWarning("已经是第一个输入框");
        }
      } else {
        showBoundaryWarning("已经是第一个输入框");
      }
    },
    [
      version,
      currentIndex,
      fieldIndex,
      totalFields,
      getInputId,
      tryFocus,
      showBoundaryWarning,
    ],
  );

  return {
    handleEnterKey,
    handleBackspaceKey,
  };
}
