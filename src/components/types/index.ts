import type { JointContent } from "antd/es/message/interface";
import type { FeedbackGenerationState } from "../../domain/ai";

// 学生基础信息接口 (静态信息)
export interface StudentBasicInfo {
  name: string;
  gender: "male" | "female";
  version: StudentContentPropsVersion; // 每个学生独立的版本选择
}

// 学生动态信息接口 (运行时状态)
export interface StudentsInfo {
  name: string;
  content: string;
  think_content: string;
  loading: boolean;
  activated: boolean;
  generation?: FeedbackGenerationState;
}

// 班级时间接口
export interface ClassTime {
  readonly time: {
    readonly first: string;
    readonly last: string;
  };
}

// 历史记录类型
export interface HistoryType {
  courseName: string;
  courseContents: { item: string }[];
  courseObjectives: { item: string }[];
  time: [string, string] | undefined;
}

export interface HistorysType {
  [key: string]: HistoryType;
}

// 内置提示词类型
export type BuiltInPromptType =
  | "programming"
  | "programming_v2"
  | "robot"
  | "robot_v2";

// 当前选中的提示词可以是内置模板，也可以是用户创建的模板
export type PromptType = BuiltInPromptType | (string & {});

// 提示词项接口
export interface PromptItem {
  name: string;
  prompt: string;
}

export type PromptItems = Record<BuiltInPromptType, PromptItem>;

// 模板编辑器组件属性接口
export interface TemplateEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: string, signature: string) => void;
  initialTemplate: string;
  initialSignature: string;
  sendMessage: (content: JointContent) => void;
}

// 学生信息卡片组件属性版本
export type StudentContentPropsVersion = "v1" | "v2";

// V1版本的输入联想数据接口
export interface V1InputSuggestions {
  [className: string]: string[]; // 班级名对应的所有输入建议
}

// V2版本的快捷选项数据接口
export interface V2QuickOptions {
  total: string[];
  mastery_situation: string[];
  attention: string[];
  interaction: string[];
  other: string[];
}
