import type { CourseTemplateContext } from "../../domain/course";
import type { StudentBasicInfo, StudentsInfo } from "../../components/types";
import { replaceTemplate } from "../../utils";

export const DEFAULT_FEEDBACK_TEMPLATE = `**课程名称:** {{courseName}}

**授课时间:** {{courseTime}}

**课程内容概览:**
{{courseContents}}

**教学目标:**
{{courseObjectives}}

**课堂表现:**
{{courseFeedback}}

{{signature}}
{{currentDate}}`;

export interface StudentFeedbackExportInput {
  courseContext: CourseTemplateContext;
  customTemplate: string;
  signature: string;
  student: StudentBasicInfo;
  studentInfo?: StudentsInfo;
}

export const buildStudentFeedbackMarkdown = ({
  courseContext,
  customTemplate,
  signature,
  student,
  studentInfo,
}: StudentFeedbackExportInput) => {
  const studentTemplate = replaceTemplate(customTemplate, {
    studentName: student.name,
    courseName: courseContext.courseName,
    courseTime: courseContext.courseTime,
    courseContents: courseContext.courseContents,
    courseObjectives: courseContext.courseObjectives,
    signature,
    courseFeedback: studentInfo?.content || "",
  });

  return `### ${student.name}\n${studentTemplate}`;
};

export interface FeedbackBatchExportInput {
  courseContext: CourseTemplateContext;
  customTemplate: string;
  signature: string;
  students: StudentBasicInfo[];
  studentsInfo: Record<number, StudentsInfo>;
  onlyReadyAndActivated?: boolean;
}

export const buildFeedbackBatchMarkdown = ({
  courseContext,
  customTemplate,
  signature,
  students,
  studentsInfo,
  onlyReadyAndActivated = false,
}: FeedbackBatchExportInput) => {
  return students
    .map((student, index) => {
      const studentInfo = studentsInfo[index];
      if (
        onlyReadyAndActivated &&
        (!studentInfo?.content || !studentInfo.activated)
      ) {
        return null;
      }

      return `${buildStudentFeedbackMarkdown({
        courseContext,
        customTemplate,
        signature,
        student,
        studentInfo,
      })}\n\n---\n`;
    })
    .filter((content): content is string => content !== null)
    .join("");
};

export const cleanGeneratedFeedback = (content: string) => {
  return content
    .replace(/(?:(?:\*\*)?课堂表现.*?(?::|：)(?:\*\*)?)(?::|：)?/, "")
    .replace(/\d{4}年 ?\d{1,2}月\d{1,2}(?:日|天)/, "")
    .replace(/哆啦人工智能小栈/, "")
    .trim();
};
