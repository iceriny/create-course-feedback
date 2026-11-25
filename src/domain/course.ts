import dayjs from "dayjs";
import type { LessonCourse } from "./lesson";

export type CourseListItem = { item: string };

export interface CourseTemplateContext {
  className: string;
  courseName: string;
  courseContentItems: CourseListItem[];
  courseObjectiveItems: CourseListItem[];
  courseContents: string[];
  courseObjectives: string[];
  courseTime: [dayjs.Dayjs, dayjs.Dayjs];
}

export interface CourseFormValues {
  "class-name"?: unknown;
  "course-name"?: unknown;
  "course-contents"?: unknown;
  "course-objectives"?: unknown;
  "course-time"?: unknown;
}

export const normalizeCourseItems = (items: unknown): CourseListItem[] => {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => {
      if (typeof item === "string") {
        return { item: item.trim() };
      }

      if (
        item &&
        typeof item === "object" &&
        "item" in item &&
        typeof item.item === "string"
      ) {
        return { item: item.item.trim() };
      }

      return undefined;
    })
    .filter((item): item is CourseListItem =>
      Boolean(item?.item && item.item !== ""),
    );
};

export const hasCompleteCourseTime = (
  time: unknown,
): time is [dayjs.Dayjs, dayjs.Dayjs] => {
  return (
    Array.isArray(time) &&
    time.length === 2 &&
    dayjs.isDayjs(time[0]) &&
    dayjs.isDayjs(time[1]) &&
    time[0].isValid() &&
    time[1].isValid() &&
    time[1].isAfter(time[0])
  );
};

export const buildCourseTemplateContext = (
  values: CourseFormValues,
): CourseTemplateContext | null => {
  const className =
    typeof values["class-name"] === "string" ? values["class-name"].trim() : "";
  const courseName =
    typeof values["course-name"] === "string"
      ? values["course-name"].trim()
      : "";
  const courseContentItems = normalizeCourseItems(values["course-contents"]);
  const courseObjectiveItems = normalizeCourseItems(
    values["course-objectives"],
  );
  const courseTime = values["course-time"];

  if (
    !className ||
    !courseName ||
    courseContentItems.length === 0 ||
    courseObjectiveItems.length === 0 ||
    !hasCompleteCourseTime(courseTime)
  ) {
    return null;
  }

  return {
    className,
    courseName,
    courseContentItems,
    courseObjectiveItems,
    courseContents: courseContentItems.map((item) => `- ${item.item}\n`),
    courseObjectives: courseObjectiveItems.map((item) => `- ${item.item}\n`),
    courseTime,
  };
};

export type CourseField = "name" | "time" | "contents" | "objectives";

export function getCourseIssues(course: LessonCourse) {
  const issues: { field: CourseField; message: string }[] = [];
  if (!course.name.trim())
    issues.push({ field: "name", message: "填写课程名称" });
  if (!hasCompleteCourseTime([dayjs(course.start), dayjs(course.end)]))
    issues.push({
      field: "time",
      message:
        course.start && course.end
          ? "检查授课时间的开始和结束"
          : "选择授课时间",
    });
  if (!course.contents.trim())
    issues.push({ field: "contents", message: "填写课程内容" });
  if (!course.objectives.trim())
    issues.push({ field: "objectives", message: "填写教学目标" });
  return issues;
}

export function lessonCourseContext(activeClass: string, course: LessonCourse) {
  return buildCourseTemplateContext({
    "class-name": activeClass,
    "course-name": course.name,
    "course-time": [dayjs(course.start), dayjs(course.end)],
    "course-contents": course.contents.split("\n"),
    "course-objectives": course.objectives.split("\n"),
  });
}
