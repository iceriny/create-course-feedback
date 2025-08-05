import type { JointContent } from "antd/es/message/interface";

// 学生信息接口
export interface StudentsInfo {
  name: string;
  content: string;
  think_content: string;
  loading: boolean;
  activated: boolean;
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
  courseContents: string[];
  courseObjectives: string[];
}

export interface HistorysType {
  [key: string]: HistoryType;
}

// 提示词类型
export type PromptType = "programming" | "robot";

// 提示词项接口
export interface PromptItem {
  name: string;
  prompt: string;
}

export type PromptItems = Record<PromptType, PromptItem>;

// 模板编辑器组件属性接口
export interface TemplateEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (template: string, signature: string) => void;
  initialTemplate: string;
  initialSignature: string;
  sendMessage: (content: JointContent) => void;
}
