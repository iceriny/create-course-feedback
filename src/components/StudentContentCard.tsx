// Ant Design 图标 - 按需导入
import { LoadingOutlined, ReloadOutlined } from "@ant-design/icons";

// Ant Design 组件 - 按需导入
import {
  AutoComplete,
  Button,
  Card,
  Collapse,
  Flex,
  Form,
  Typography,
  Select,
  theme,
} from "antd";

// React hooks
import React, { memo, useState, useCallback } from "react";

// 内部组件和类型
import CopyButton from "./CopyButton";
import { StudentsInfo, StudentBasicInfo } from "./types";
import { nextFocus } from "../utils";
import { V1InputSuggestionManager, V2QuickOptionsManager } from "../utils/inputAssistant";

const { useToken } = theme;

// 单个学生内容卡片组件属性接口
interface StudentContentCardProps {
  student: StudentBasicInfo;
  index: number;
  studentInfo: StudentsInfo;
  className: string; // 班级名，用于输入联想
  handleSingleAIOptimize: (index: number) => void;
  copyToClipboard: (text: string) => void;
  copyStudentWithTemplate: (index: number) => void;
  onUpdateStudentGender: (index: number, gender: "male" | "female") => void;
  onUpdateStudentVersion: (index: number, version: "v1" | "v2") => void;
}

export type StudentContentItemKey = "total" | "mastery_situation" | "attention" | "interaction" | "other";
export type StudentContentItemLabel = "整体表现" | "掌握情况" | "专注度" | "互动" | "其他";
export interface StudentContentItemProps {
  itemKey: StudentContentItemKey;
  label: StudentContentItemLabel;
}
const StudentContentItem: StudentContentItemProps[] = [
  {
    itemKey: "total",
    label: "整体表现",
  },
  {
    itemKey: "mastery_situation",
    label: "掌握情况",
  },
  {
    itemKey: "attention",
    label: "专注度",
  },
  {
    itemKey: "interaction",
    label: "互动",
  },
  {
    itemKey: "other",
    label: "其他",
  }
];

/**
 * 单个学生内容卡片组件
 */
const StudentContentCard = memo(
  ({
    student,
    index,
    studentInfo,
    className,
    handleSingleAIOptimize,
    copyToClipboard,
    copyStudentWithTemplate,
    onUpdateStudentGender,
    onUpdateStudentVersion,
  }: StudentContentCardProps) => {
    const { token } = useToken();

    // V1版本输入联想状态
    const [v1Suggestions, setV1Suggestions] = useState<string[]>([]);

    // V2版本快捷选项
    const v2Options = V2QuickOptionsManager.getOptions();

    // 处理V1输入变化，提供联想建议
    const handleV1InputChange = useCallback((value: string) => {
      if (student.version === "v1" && className) {
        const suggestions = V1InputSuggestionManager.searchSuggestions(className, value);
        setV1Suggestions(suggestions);
      }
    }, [student.version, className]);

    // 处理V1输入确认，保存到建议库
    const handleV1InputBlur = useCallback((value: string) => {
      if (student.version === "v1" && className && value.trim()) {
        V1InputSuggestionManager.addSuggestion(className, value.trim());
      }
    }, [student.version, className]);

    // 处理V2输入确认，保存到快捷选项库
    const handleV2InputBlur = useCallback((field: keyof typeof v2Options, value: string) => {
      if (student.version === "v2" && value.trim()) {
        V2QuickOptionsManager.addCustomOption(field, value.trim());
      }
    }, [student.version]);

    return (
      <Card
        id={`student-content-${index}`}
        style={{
          marginBottom: "2rem",
          boxShadow: "10px 10px 20px 10px rgba(0, 0, 0, 0.05)",
        }}
        key={index}
        size="small"
        title={
          <Flex justify="space-between" align="center">
            <div style={{ display: "flex", alignItems: "center" }}>
              <Typography.Text style={{ alignContent: "center", marginRight: "20px" }}>
                <span
                  style={{
                    marginRight: "20px",
                  }}
                >
                  {index + 1}
                </span>
                {student.name}
              </Typography.Text>
              <Select
                size="small"
                style={{ width: 80, marginRight: 10 }}
                options={[
                  { label: "男", value: "male" },
                  { label: "女", value: "female" }
                ]}
                value={student.gender}
                onChange={(value: "male" | "female") => {
                  onUpdateStudentGender(index, value);
                }}
              />
              <Select
                size="small"
                style={{ width: 60 }}
                options={[
                  { label: "V1", value: "v1" },
                  { label: "V2", value: "v2" }
                ]}
                value={student.version}
                onChange={(value: "v1" | "v2") => {
                  onUpdateStudentVersion(index, value);
                }}
              />
            </div>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              <Button
                type="link"
                style={{ marginLeft: "1rem" }}
                size="small"
                icon={<ReloadOutlined />}
                onClick={() => {
                  handleSingleAIOptimize(index);
                }}
                disabled={studentInfo.loading}
              >
                重新或单独生成
              </Button>
              <CopyButton
                disabled={!studentInfo.activated || studentInfo.loading}
                onClick={() => {
                  copyStudentWithTemplate(index);
                }}
              />
            </div>
          </Flex>
        }
      >
        {/* 学生课堂表现输入框 */}
        {student.version === "v1" ? (
          <Form.Item name={["content", index]}>
            <AutoComplete
              id={`student-content-input-${index}`}
              disabled={!studentInfo.activated}
              size="small"
              placeholder="填写学生课堂表现关键词（支持输入联想）"
              options={v1Suggestions.map((suggestion, suggestionIndex) => ({
                key: `v1-${index}-${suggestionIndex}-${suggestion}`,
                value: suggestion
              }))}
              onSearch={handleV1InputChange}
              onBlur={(e) => handleV1InputBlur((e.target as HTMLInputElement).value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  const inputElement = event.target as HTMLInputElement;
                  handleV1InputBlur(inputElement.value);
                  const target = document.getElementById(
                      `student-content-input-${index + 1}`,
                  ) as HTMLInputElement;
                  if (target && nextFocus(event as React.KeyboardEvent<HTMLInputElement>, target)) {
                      // TODO: 提示为最后一个输入框
                      console.log("success");
                  }
                }
                if (event.key === "Backspace" && (event.target as HTMLInputElement).value === "") {
                    const target = document.getElementById(
                        `student-content-input-${index - 1}`,
                    ) as HTMLInputElement;
                    if (target && nextFocus(event as React.KeyboardEvent<HTMLInputElement>, target)) {
                        // TODO: 提示为第一个输入框
                        console.log("success");
                    }
                }
              }}
            />
          </Form.Item>
        ) : (
          // v2版本
          StudentContentItem.map((item, i) =>
            <Form.Item
              key={`${index}-${item.itemKey}`}
              name={["content", index, item.itemKey]}
              label={item.label}
              labelCol={{ span: 2 }}
            >
              <AutoComplete
                id={`student-content-input-${index}-${i}`}
                disabled={!studentInfo.activated}
                size="middle"
                style={{ width: '100%' }}
                placeholder={`输入${item.label}内容（支持快捷选项）`}
                options={v2Options[item.itemKey].map((option, optionIndex) => ({
                  key: `${item.itemKey}-${optionIndex}-${option}`,
                  value: option
                }))}
                onBlur={(e) => handleV2InputBlur(item.itemKey, (e.target as HTMLInputElement).value)}
                onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      const inputElement = event.target as HTMLInputElement;
                      handleV2InputBlur(item.itemKey, inputElement.value);

                      if (event.shiftKey) {
                          return;
                      }
                      if (event.altKey) {
                          const target = document.getElementById(
                              `student-content-input-${index}-${i - 1}`,
                          ) as HTMLInputElement;
                          if (target && nextFocus(event as React.KeyboardEvent<HTMLInputElement>, target)) {
                              // TODO: 提示为第一个输入框
                              console.log("success");
                          }
                      }
                      else {
                      const target = document.getElementById(
                          `student-content-input-${index}-${i + 1}`,
                      ) as HTMLInputElement;
                      if (target && nextFocus(event as React.KeyboardEvent<HTMLInputElement>, target)) {
                          // TODO: 提示为最后一个输入框
                          console.log("success");
                      } else {
                          const target = document.getElementById(
                              `student-content-input-${index + 1}-${0}`,
                          ) as HTMLInputElement;
                          if (target && nextFocus(event as React.KeyboardEvent<HTMLInputElement>, target)) {
                              // TODO: 提示为最后一个输入框
                              console.log("success");
                              }
                          }
                      }
                    }
                    if (event.key === "Backspace" && (event.target as HTMLInputElement).value === "") {
                        const target = document.getElementById(
                            `student-content-input-${index}-${i - 1}`,
                        ) as HTMLInputElement;
                        if (target && nextFocus(event as React.KeyboardEvent<HTMLInputElement>, target)) {
                            // TODO: 提示为第一个输入框
                            console.log("success");
                        }
                        else {
                            const target = document.getElementById(
                                `student-content-input-${index + 1}-${0}`,
                            ) as HTMLInputElement;
                            if (target && nextFocus(event as React.KeyboardEvent<HTMLInputElement>, target)) {
                                // TODO: 提示为最后一个输入框
                                console.log("success");
                            }
                        }
                    }
                }}
              />
            </Form.Item>
          )
        )}

        {
          // 加载动画
          studentInfo?.loading && (
            <Flex
              justify="center"
              align="center"
              style={{
                marginTop: "1rem",
                marginBottom: "1rem",
              }}
            >
              <LoadingOutlined
                style={{
                  fontSize: "1.5rem",
                  color: token.colorPrimary,
                }}
              />
            </Flex>
          )
        }
        {/* ai输出内容 */}
        {studentInfo.activated && (
          <Collapse
            size="small"
            items={[
              {
                key: `think_${index}`,
                label: (
                  <Flex justify="space-between">
                    思考
                    <CopyButton
                      disabled={
                        !studentInfo.activated ||
                        studentInfo.loading ||
                        studentInfo.think_content === ""
                      }
                      onClick={() => {
                        copyToClipboard(studentInfo?.think_content);
                      }}
                    />
                  </Flex>
                ),
                children: (
                  <Typography.Paragraph type="secondary">
                    {studentInfo?.think_content}
                  </Typography.Paragraph>
                ),
              },
              {
                key: `content_${index}`,
                label: (
                  <Flex justify="space-between">
                    内容
                    <CopyButton
                      disabled={
                        !studentInfo.activated ||
                        studentInfo.loading ||
                        studentInfo.content === ""
                      }
                      onClick={() => {
                        copyToClipboard(studentInfo?.content);
                      }}
                    />
                  </Flex>
                ),
                children: (
                  <Typography.Paragraph
                    style={{
                      width: "100%",
                    }}
                  >
                    {studentInfo?.content}
                  </Typography.Paragraph>
                ),
              },
            ]}
            defaultActiveKey={[`content_${index}`]}
          />
        )}
      </Card>
    );
  },
);

export default StudentContentCard;
