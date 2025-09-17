import { memo } from "react";
import StudentContentCard from "./StudentContentCard";
import { StudentsInfo, StudentContentPropsVersion } from "./types";

// 学生列表组件属性接口
interface StudentsListProps {
  students: string[];
  students_info: { [key: number]: StudentsInfo };
  propsVersion: StudentContentPropsVersion;
  handleSingleAIOptimize: (index: number) => void;
  copyToClipboard: (text: string) => void;
  copyStudentWithTemplate: (index: number) => void;
}

/**
 * 学生列表组件
 */
const StudentsList = memo(
  ({
    students,
    students_info,
    propsVersion,
    handleSingleAIOptimize,
    copyToClipboard,
    copyStudentWithTemplate,
  }: StudentsListProps) => {
    return (
      <>
        {students.map((student, index) => (
          <StudentContentCard
            propsVersion={propsVersion}
            key={`student-card-${index}`}
            student={student.replace("|", "")}
            index={index}
            studentInfo={students_info[index]}
            handleSingleAIOptimize={handleSingleAIOptimize}
            copyToClipboard={copyToClipboard}
            copyStudentWithTemplate={copyStudentWithTemplate}
          />
        ))}
      </>
    );
  },
);

export default StudentsList;
