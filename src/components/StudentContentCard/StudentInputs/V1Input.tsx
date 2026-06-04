import React, { memo, useState, useCallback, useMemo } from "react";
import { AutoComplete, Form } from "antd";
import { useKeyboardNavigation } from "../../../hooks";
import { useInputAssistantStore } from "../../../store/InputAssistantStore";
import type { JointContent } from "antd/es/message/interface";

interface V1InputProps {
  index: number;
  className: string;
  disabled: boolean;
  totalStudents: number;
  sendWarning: (content: JointContent, duration?: number | VoidFunction, onClose?: VoidFunction) => void;
}

/**
 * V1版本输入组件 - 优化后的单一输入框
 */
const V1Input = memo(({ index, className, disabled, totalStudents, sendWarning }: V1InputProps) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);

  // 使用 zustand store
  const searchV1Suggestions = useInputAssistantStore(
    (state) => state.searchV1Suggestions,
  );
  const addV1Suggestion = useInputAssistantStore(
    (state) => state.addV1Suggestion,
  );

  // 键盘导航
  const { handleEnterKey, handleBackspaceKey } = useKeyboardNavigation({
    currentIndex: index,
    totalStudents,
    version: "v1",
    sendWarning
  });

  // 处理输入变化，提供联想建议
  const handleInputChange = useCallback((value: string) => {
    if (!className) return;

    const newSuggestions = searchV1Suggestions(className, value);
    setSuggestions(newSuggestions);
  }, [className, searchV1Suggestions]);

  // 处理输入确认，保存到建议库
  const handleInputBlur = useCallback(async (value: string) => {
    if (!className || !value.trim()) return;

    await addV1Suggestion(className, value.trim());
  }, [className, addV1Suggestion]);

  // 键盘事件处理
  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
    const inputElement = event.target as HTMLInputElement;

    if (event.key === "Enter") {
      handleInputBlur(inputElement.value);
      handleEnterKey(event);
    } else if (event.key === "Backspace" && inputElement.value === "") {
      handleBackspaceKey(event);
    }
  }, [handleInputBlur, handleEnterKey, handleBackspaceKey]);

  // 优化建议选项渲染
  const suggestionOptions = useMemo(() =>
    suggestions.map((suggestion, suggestionIndex) => ({
      key: `v1-${index}-${suggestionIndex}-${suggestion}`,
      value: suggestion
    }))
  , [suggestions, index]);

  return (
    <Form.Item name={["content", index]}>
      <AutoComplete
        id={`student-content-input-${index}`}
        disabled={disabled}
        size="small"
        placeholder="填写学生课堂表现关键词"
        options={suggestionOptions}
        onSearch={handleInputChange}
        onBlur={(e) => handleInputBlur((e.target as HTMLInputElement).value)}
        onKeyDown={handleKeyDown}
      />
    </Form.Item>
  );
});

V1Input.displayName = "V1Input";

export default V1Input;
