import type { CourseTemplateContext } from "../../domain/course";
import type { StudentBasicInfo, StudentsInfo } from "../../types";
import {
  isFeedbackConfirmed,
  isFeedbackReviewable,
} from "../../domain/feedbackStatus";
import {
  isTemplatePlaceholder,
  readTemplatePlaceholders,
  replaceTemplate,
} from "../../utils/template";

export const DEFAULT_FEEDBACK_SIGNATURE = "哆啦人工智能小栈";

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

export function getFeedbackTemplateIssues(template: string): string[] {
  const placeholders = new Set(readTemplatePlaceholders(template));
  const issues: string[] = [];
  if (!placeholders.has("courseFeedback"))
    issues.push("请插入“课堂表现”字段，以包含每位学生的反馈正文。");
  for (const placeholder of placeholders) {
    if (!isTemplatePlaceholder(placeholder))
      issues.push(
        `无法识别字段 {{${placeholder}}}，请从可插入字段中重新选择。`,
      );
  }
  return issues;
}

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
      if (onlyReadyAndActivated && !isFeedbackReviewable(studentInfo))
        return null;
      if (onlyConfirmed && !isFeedbackConfirmed(studentInfo)) return null;
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
    .replace(DEFAULT_FEEDBACK_SIGNATURE, "")
    .trim();
};

export const toPlainText = (text: string) =>
  text
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^---$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
