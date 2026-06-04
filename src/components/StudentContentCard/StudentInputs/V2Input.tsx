import React, { memo, useCallback, useMemo } from "react";
import { AutoComplete, Form } from "antd";
import { useKeyboardNavigation } from "../../../hooks";
import { useInputAssistantStore } from "../../../store/InputAssistantStore";
import type { JointContent } from "antd/es/message/interface";
import { StudentContentItems } from "./V2InputStudentContentItemsConst";

export type StudentContentItemKey =
  | "total"
  | "mastery_situation"
  | "attention"
  | "interaction"
  | "other";
export type StudentContentItemLabel =
  | "整体表现"
  | "掌握情况"
  | "专注度"
  | "互动"
  | "其他";

export interface StudentContentItemProps {
  itemKey: StudentContentItemKey;
  label: StudentContentItemLabel;
}

interface V2InputItemProps {
  index: number;
  fieldIndex: number;
  item: StudentContentItemProps;
  disabled: boolean;
  totalStudents: number;
  totalFields: number;
  sendWarning: (
    content: JointContent,
    duration?: number | VoidFunction,
    onClose?: VoidFunction,
  ) => void;
}

/**
 * V2版本单个输入项组件
 */
const V2InputItem = memo(
  ({
    index,
    fieldIndex,
    item,
    disabled,
    totalStudents,
    totalFields,
    sendWarning,
  }: V2InputItemProps) => {
    // 使用 zustand store
    const getV2Options = useInputAssistantStore((state) => state.getV2Options);
    const addV2CustomOption = useInputAssistantStore(
      (state) => state.addV2CustomOption,
    );

    // 键盘导航
    const { handleEnterKey, handleBackspaceKey } = useKeyboardNavigation({
      currentIndex: index,
      fieldIndex,
      totalStudents,
      totalFields,
      version: "v2",
      sendWarning,
    });

    // 处理输入确认，保存到快捷选项库
    const handleInputBlur = useCallback(
      async (value: string) => {
        if (!value.trim()) return;

        await addV2CustomOption(item.itemKey, value.trim());
      },
      [item.itemKey, addV2CustomOption],
    );

    // 键盘事件处理
    const handleKeyDown = useCallback(
      (event: React.KeyboardEvent<HTMLInputElement>) => {
        const inputElement = event.target as HTMLInputElement;

        if (event.key === "Enter") {
          handleInputBlur(inputElement.value);
          handleEnterKey(event);
        } else if (event.key === "Backspace" && inputElement.value === "") {
          handleBackspaceKey(event);
        }

        // 阻断Alt键的默认行为
        if (event.altKey) {
          event.preventDefault();
          event.stopPropagation();
        }
      },
      [handleInputBlur, handleEnterKey, handleBackspaceKey],
    );

    // 获取选项数据并优化渲染
    const options = useMemo(() => {
      const v2Options = getV2Options();
      return v2Options[item.itemKey].map((option, optionIndex) => ({
        key: `${item.itemKey}-${optionIndex}-${option}`,
        value: option,
      }));
    }, [item.itemKey, getV2Options]);

    return (
      <Form.Item
        key={`${index}-${item.itemKey}`}
        name={["content", index, item.itemKey]}
        label={item.label}
        labelCol={{ span: 2 }}
      >
        <AutoComplete
          id={`student-content-input-${index}-${fieldIndex}`}
          disabled={disabled}
          size="middle"
          style={{ width: "100%" }}
          placeholder={`输入${item.label}内容`}
          options={options}
          onBlur={(e) => handleInputBlur((e.target as HTMLInputElement).value)}
          onKeyDown={handleKeyDown}
        />
      </Form.Item>
    );
  },
);

V2InputItem.displayName = "V2InputItem";

interface V2InputProps {
  index: number;
  disabled: boolean;
  totalStudents: number;
  sendWarning: (
    content: JointContent,
    duration?: number | VoidFunction,
    onClose?: VoidFunction,
  ) => void;
}

/**
 * V2版本输入组件 - 多字段输入
 */
const V2Input = memo(
  ({ index, disabled, totalStudents, sendWarning }: V2InputProps) => {
    const totalFields = StudentContentItems.length;

    return (
      <>
        {StudentContentItems.map((item, fieldIndex) => (
          <V2InputItem
            key={`${index}-${item.itemKey}`}
            index={index}
            fieldIndex={fieldIndex}
            item={item}
            disabled={disabled}
            totalStudents={totalStudents}
            totalFields={totalFields}
            sendWarning={sendWarning}
          />
        ))}
      </>
    );
  },
);

V2Input.displayName = "V2Input";

export default V2Input;
