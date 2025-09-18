import { memo } from "react";
import StudentContentCard from "./StudentContentCard";
import { StudentsInfo, StudentBasicInfo } from "./types";

// 学生列表组件属性接口
interface StudentsListProps {
  students: StudentBasicInfo[];
  students_info: { [key: number]: StudentsInfo };
  className: string; // 班级名，用于输入联想
  handleSingleAIOptimize: (index: number) => void;
  copyToClipboard: (text: string) => void;
  copyStudentWithTemplate: (index: number) => void;
  onUpdateStudentGender: (index: number, gender: "male" | "female") => void;
  onUpdateStudentVersion: (index: number, version: "v1" | "v2") => void;
}

/**
 * 学生列表组件
 */
const StudentsList = memo(
  ({
    students,
    students_info,
    className,
    handleSingleAIOptimize,
    copyToClipboard,
    copyStudentWithTemplate,
    onUpdateStudentGender,
    onUpdateStudentVersion,
  }: StudentsListProps) => {
    return (
      <>
        {students.map((student, index) => {
          const studentInfo = students_info[index];
          // 只有当studentInfo存在时才渲染StudentContentCard
          if (!studentInfo) return null;

          return (
            <StudentContentCard
              key={`student-card-${index}`}
              student={student}
              index={index}
              studentInfo={studentInfo}
              className={className}
              handleSingleAIOptimize={handleSingleAIOptimize}
              copyToClipboard={copyToClipboard}
              copyStudentWithTemplate={copyStudentWithTemplate}
              onUpdateStudentGender={onUpdateStudentGender}
              onUpdateStudentVersion={onUpdateStudentVersion}
            />
          );
        })}
      </>
    );
  },
);

export default StudentsList;
