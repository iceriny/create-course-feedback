// Ant Design 组件 - 按需导入
import { Card } from "antd";

// React hooks
import { memo, useMemo } from "react";

// 内部组件和类型
import { StudentsInfo, StudentBasicInfo } from "../types";
import { V1Input, V2Input } from "./StudentInputs";
import { StudentCollapseContent } from "../StudentOutputs";
import { StudentCardHeader } from "./StudentCardHeader";
import { LoadingIndicator } from "../LoadingIndicator";
import type { JointContent } from "antd/es/message/interface";

// 单个学生内容卡片组件属性接口
interface StudentContentCardProps {
  student: StudentBasicInfo;
  index: number;
  studentInfo: StudentsInfo;
  className: string; // 班级名，用于输入联想
  totalStudents: number; // 学生总数，用于键盘导航
  handleSingleAIOptimize: (index: number) => void;
  copyToClipboard: (text: string) => void;
  copyStudentWithTemplate: (index: number) => void;
  onUpdateStudentGender: (index: number, gender: "male" | "female") => void;
  onUpdateStudentVersion: (index: number, version: "v1" | "v2") => void;
  sendWarning: (content: JointContent, duration?: number | VoidFunction, onClose?: VoidFunction) => void;
}

// 类型定义移动到子组件中
export type { StudentContentItemKey, StudentContentItemLabel, StudentContentItemProps } from "./StudentInputs";

/**
 * 单个学生内容卡片组件 - 优化后版本
 */
const StudentContentCard = memo(
  ({
    student,
    index,
    studentInfo,
    className,
    totalStudents,
    handleSingleAIOptimize,
    copyToClipboard,
    copyStudentWithTemplate,
    onUpdateStudentGender,
    onUpdateStudentVersion,
    sendWarning,
  }: StudentContentCardProps) => {

    // 优化卡片样式配置
    const cardStyle = useMemo(() => ({
      marginBottom: "2rem",
      boxShadow: "10px 10px 20px 10px rgba(0, 0, 0, 0.05)",
    }), []);

    return (
      <Card
        id={`student-content-${index}`}
        style={cardStyle}
        key={index}
        size="small"
        title={
          <StudentCardHeader
            student={student}
            index={index}
            studentInfo={studentInfo}
            handleSingleAIOptimize={handleSingleAIOptimize}
            copyStudentWithTemplate={copyStudentWithTemplate}
            onUpdateStudentGender={onUpdateStudentGender}
            onUpdateStudentVersion={onUpdateStudentVersion}
          />
        }
      >
        {/* 学生课堂表现输入框 - 优化后的组件 */}
        {student.version === "v1" ? (
          <V1Input
            index={index}
            className={className}
            disabled={!studentInfo.activated}
            totalStudents={totalStudents}
            sendWarning={sendWarning}
          />
        ) : (
          <V2Input
            index={index}
            disabled={!studentInfo.activated}
            totalStudents={totalStudents}
            sendWarning={sendWarning}
          />
        )}

        {/* 加载指示器 */}
        <LoadingIndicator loading={studentInfo?.loading} />

        {/* AI 输出内容 */}
        <StudentCollapseContent
          index={index}
          studentInfo={studentInfo}
          copyToClipboard={copyToClipboard}
        />
      </Card>
    );
  },
);

export default StudentContentCard;
