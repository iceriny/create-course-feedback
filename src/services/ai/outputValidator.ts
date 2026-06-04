import type {
  FeedbackQualityIssue,
  FeedbackQualityReport,
} from "../../domain/ai";

const ABSOLUTE_WORDS = ["一直", "总是", "完全没有", "从来不"];

export interface FeedbackValidationInput {
  allowedStudentName: string;
  blockedStudentNames: string[];
  content: string;
  now?: Date;
}

const createIssue = (issue: FeedbackQualityIssue): FeedbackQualityIssue =>
  issue;

export const validateGeneratedFeedback = ({
  allowedStudentName,
  blockedStudentNames,
  content,
  now = new Date(),
}: FeedbackValidationInput): FeedbackQualityReport => {
  const issues: FeedbackQualityIssue[] = [];
  const text = content.trim();

  if (!text) {
    issues.push(
      createIssue({
        code: "empty",
        message: "没有生成反馈内容。",
        severity: "error",
      }),
    );
  }

  if (text && text.length < 20) {
    issues.push(
      createIssue({
        code: "too_short",
        message: "反馈内容偏短，建议再检查一下。",
        severity: "warning",
      }),
    );
  }

  for (const studentName of blockedStudentNames) {
    if (
      studentName &&
      studentName !== allowedStudentName &&
      text.includes(studentName)
    ) {
      issues.push(
        createIssue({
          code: "other_student_name",
          message: "反馈中出现了其他学生姓名。",
          severity: "error",
        }),
      );
      break;
    }
  }

  if (
    /{{.+?}}/.test(text) ||
    /课程名称|授课时间|教学目标|课程内容概览/.test(text)
  ) {
    issues.push(
      createIssue({
        code: "template_residue",
        message: "反馈中包含课程模板内容。",
        severity: "warning",
      }),
    );
  }

  if (ABSOLUTE_WORDS.some((word) => text.includes(word))) {
    issues.push(
      createIssue({
        code: "absolute_word",
        message: "反馈中有较绝对的表达，建议确认是否准确。",
        severity: "warning",
      }),
    );
  }

  return {
    checkedAt: now.toISOString(),
    issues,
    status: issues.some((issue) => issue.severity === "error")
      ? "review"
      : issues.length > 0
        ? "review"
        : "pass",
  };
};
