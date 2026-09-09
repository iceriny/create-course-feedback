import type { CourseTemplateContext } from "../../domain/course";
import type { StudentBasicInfo, StudentsInfo } from "../../types";
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
  onlyConfirmed?: boolean;
}

export const buildFeedbackBatchMarkdown = ({
  courseContext,
  customTemplate,
  signature,
  students,
  studentsInfo,
  onlyReadyAndActivated = false,
  onlyConfirmed = false,
}: FeedbackBatchExportInput) => {
  return students
    .map((student, index) => {
      const studentInfo = studentsInfo[index];
      if (
        onlyReadyAndActivated &&
        (!studentInfo?.content?.trim() ||
          !studentInfo.activated ||
          studentInfo.loading ||
          studentInfo.generation?.status === "failed" ||
          studentInfo.generation?.status === "queued")
      ) {
        return null;
      }

      if (onlyConfirmed && !studentInfo?.confirmed) return null;
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

export const toPlainText = (text: string) =>
  text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^---$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
