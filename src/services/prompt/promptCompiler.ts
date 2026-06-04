import type { Message } from "../../AI_API/API";
import type { CourseTemplateContext } from "../../domain/course";
import type { StudentBasicInfo } from "../../components/types";
import { replaceTemplate } from "../../utils";

export const AI_COURSE_CONTEXT_TEMPLATE = `**课程名称:** {{courseName}}

**授课时间:** {{courseTime}}

**课程内容概览:**
{{courseContents}}

**教学目标:**
{{courseObjectives}}`;

export const compileCoursePromptContext = (
  courseContext: CourseTemplateContext,
) => {
  return replaceTemplate(AI_COURSE_CONTEXT_TEMPLATE, {
    courseName: courseContext.courseName,
    courseTime: courseContext.courseTime,
    courseContents: courseContext.courseContents,
    courseObjectives: courseContext.courseObjectives,
  });
};

export interface StudentGenerationMessagesInput {
  systemPrompt: string;
  coursePromptContext: string;
  student: StudentBasicInfo;
  performanceText: string;
}

export const buildStudentGenerationMessages = ({
  systemPrompt,
  coursePromptContext,
  student,
  performanceText,
}: StudentGenerationMessagesInput): Message[] => {
  return [
    { content: systemPrompt, role: "system" },
    { content: coursePromptContext, role: "user" },
    {
      content: `学员姓名: ${student.name}`,
      role: "user",
    },
    {
      content: performanceText,
      role: "user",
    },
  ];
};
