import { memo } from "react";
import StudentContentCard from "./StudentContentCard";
import { StudentsInfo } from "./types";

// 学生列表组件属性接口
interface StudentsListProps {
    students: string[];
    students_info: { [key: number]: StudentsInfo };
    handleSingleAIOptimize: (index: number) => void;
    copyToClipboard: (text: string) => void;
}

/**
 * 学生列表组件
 */
const StudentsList = memo(
    ({
        students,
        students_info,
        handleSingleAIOptimize,
        copyToClipboard,
    }: StudentsListProps) => {
        return (
            <>
                {students.map((student, index) => (
                    <StudentContentCard
                        key={`student-card-${index}`}
                        student={student}
                        index={index}
                        studentInfo={students_info[index]}
                        handleSingleAIOptimize={handleSingleAIOptimize}
                        copyToClipboard={copyToClipboard}
                    />
                ))}
            </>
        );
    }
);

export default StudentsList;
