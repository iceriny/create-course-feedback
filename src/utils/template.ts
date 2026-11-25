import dayjs from "dayjs";

export const TEMPLATE_PLACEHOLDERS = {
  studentName: "学生姓名",
  lastName: "学生姓氏",
  firstName: "学生名字",
  courseName: "课程名称",
  courseTime: "授课时间",
  courseContents: "课程内容概览",
  courseObjectives: "教学目标",
  courseFeedback: "课堂表现",
  signature: "签名",
  currentDate: "当前日期",
};

type TemplatePlaceholder = keyof typeof TEMPLATE_PLACEHOLDERS;
const placeholderPattern = /(?<!\{)\{\{([^{}\r\n]*)\}\}(?!\})/g;

export const isTemplatePlaceholder = (
  name: string,
): name is TemplatePlaceholder =>
  Object.prototype.hasOwnProperty.call(TEMPLATE_PLACEHOLDERS, name);

export const readTemplatePlaceholders = (template: string) =>
  Array.from(template.matchAll(placeholderPattern), ([, name]) => name.trim());

/**
 * 模板替换参数接口
 */
export interface TemplateReplaceParams {
  studentName?: string;
  // 课程名称
  courseName?: string;
  // 课程时间范围
  courseTime?: [dayjs.Dayjs, dayjs.Dayjs];
  // 课程内容
  courseContents?: string[];
  // 教学目标
  courseObjectives?: string[];
  // 签名
  signature?: string;
  // 学生课堂表现
  courseFeedback?: string;
  // 可选自定义日期（默认使用当前日期）
  customDate?: dayjs.Dayjs;
}

/**
 * 替换模板中的占位符
 *
 * @param template 原始模板字符串
 * @param params 替换参数
 * @returns 替换后的字符串
 */
export function replaceTemplate(
  template: string,
  params: TemplateReplaceParams,
): string {
  const studentName = params.studentName ?? "";
  const [lastName, firstName] = studentName.includes("|")
    ? studentName.split("|")
    : [studentName.charAt(0), studentName.slice(1)];
  const values: Record<TemplatePlaceholder, string> = {
    studentName,
    lastName,
    firstName,
    courseName: params.courseName ? `《${params.courseName}》` : "",
    courseTime: params.courseTime
      ? `@${params.courseTime[0].format("YYYY[年] MM[月]DD[日] HH:mm")} -> ${params.courseTime[1].format("HH:mm")}`
      : "",
    courseContents: params.courseContents?.join("") ?? "",
    courseObjectives: params.courseObjectives?.join("") ?? "",
    courseFeedback: params.courseFeedback ?? "",
    signature: params.signature ?? "",
    currentDate: (params.customDate ?? dayjs()).format("YYYY[年] MM[月]DD[日]"),
  };
  return template.replace(placeholderPattern, (match, name: string) => {
    const field = name.trim();
    return isTemplatePlaceholder(field) ? values[field] : match;
  });
}
